var CodexSessionBrowserState = (() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // scripts/browser-session-state.js
  var require_browser_session_state = __commonJS({
    "scripts/browser-session-state.js"(exports, module) {
      function comparableSessionPath(value) {
        const text = String(value || "").trim();
        if (!text) return "";
        return text === "/" ? "/" : text.replace(/\/+$/, "");
      }
      function sessionKeyFor(threadId = "", cwd = "") {
        return `${threadId || "new"}::${cwd || ""}`;
      }
      function normalizeOpenSession(item, now = Date.now()) {
        if (!item || typeof item !== "object") return null;
        const threadId = String(item.threadId || "");
        const cwd = String(item.cwd || "");
        if (!threadId && !cwd) return null;
        return {
          key: String(item.key || sessionKeyFor(threadId, cwd)),
          threadId,
          cwd,
          title: String(item.title || threadId || cwd || "New session"),
          status: String(item.status || "ready"),
          updatedAt: Number(item.updatedAt || now)
        };
      }
      function normalizeOpenSessions(items, now = Date.now()) {
        return Array.isArray(items) ? items.map((item) => normalizeOpenSession(item, now)).filter(Boolean) : [];
      }
      function normalizeClosedThreadIds(items) {
        if (!items) return /* @__PURE__ */ new Set();
        if (items instanceof Set) return new Set(Array.from(items).filter((item) => typeof item === "string" && item));
        if (Array.isArray(items)) return new Set(items.filter((item) => typeof item === "string" && item));
        return /* @__PURE__ */ new Set();
      }
      function normalizePinnedThreadIds(items) {
        return normalizeClosedThreadIds(items);
      }
      function isLiveThreadForOpenSession(thread) {
        if (!thread?.id) return false;
        return thread.source !== "history";
      }
      function cloneState(state) {
        return {
          selectedThread: state.selectedThread,
          currentWorkdir: state.currentWorkdir,
          openSessions: state.openSessions.map((item) => ({ ...item })),
          activeSessionKey: state.activeSessionKey,
          resumeCandidateSession: state.resumeCandidateSession ? { ...state.resumeCandidateSession } : null,
          closedThreadIds: new Set(state.closedThreadIds),
          pinnedThreadIds: new Set(state.pinnedThreadIds)
        };
      }
      function createSessionStore(initial = {}) {
        const state = {
          selectedThread: String(initial.selectedThread || ""),
          currentWorkdir: String(initial.currentWorkdir || ""),
          openSessions: normalizeOpenSessions(initial.openSessions),
          activeSessionKey: String(initial.activeSessionKey || ""),
          resumeCandidateSession: normalizeOpenSession(initial.resumeCandidateSession),
          closedThreadIds: normalizeClosedThreadIds(initial.closedThreadIds),
          pinnedThreadIds: normalizePinnedThreadIds(initial.pinnedThreadIds)
        };
        function snapshot() {
          return cloneState(state);
        }
        function setCurrentWorkdir(cwd) {
          state.currentWorkdir = String(cwd || state.currentWorkdir || "");
          return snapshot();
        }
        function rememberClosedThread(threadId) {
          const id = String(threadId || "");
          if (id) state.closedThreadIds.add(id);
          return snapshot();
        }
        function forgetClosedThread(threadId) {
          const id = String(threadId || "");
          if (id) state.closedThreadIds.delete(id);
          return snapshot();
        }
        function pinThread(threadId) {
          const id = String(threadId || "");
          if (id) state.pinnedThreadIds.add(id);
          return snapshot();
        }
        function unpinThread(threadId) {
          const id = String(threadId || "");
          if (id) state.pinnedThreadIds.delete(id);
          return snapshot();
        }
        function togglePinnedThread(threadId) {
          const id = String(threadId || "");
          if (!id) return snapshot();
          if (state.pinnedThreadIds.has(id)) state.pinnedThreadIds.delete(id);
          else state.pinnedThreadIds.add(id);
          return snapshot();
        }
        function setResumeCandidate(session) {
          const normalized = normalizeOpenSession(session);
          if (normalized?.threadId) state.resumeCandidateSession = normalized;
          return snapshot();
        }
        function setOpenSessions(nextSessions) {
          state.openSessions = normalizeOpenSessions(nextSessions).sort((a, b) => a.updatedAt - b.updatedAt);
        }
        function addOrUpdateOpenSession(input) {
          const session = normalizeOpenSession({
            ...input,
            key: sessionKeyFor(input?.threadId, input?.cwd),
            title: input?.title || input?.threadId || input?.cwd || "New session",
            updatedAt: Date.now()
          });
          if (!session) return snapshot();
          forgetClosedThread(session.threadId);
          const index = state.openSessions.findIndex((item) => item.key === session.key);
          if (index >= 0) state.openSessions[index] = { ...state.openSessions[index], ...session };
          else state.openSessions.push(session);
          state.activeSessionKey = session.key;
          state.resumeCandidateSession = { ...session };
          return snapshot();
        }
        function updateActiveSessionStatus(status) {
          if (!state.activeSessionKey) return snapshot();
          const active = state.openSessions.find((session) => session.key === state.activeSessionKey);
          if (active) {
            active.status = String(status || active.status || "ready");
            active.updatedAt = Date.now();
          }
          return snapshot();
        }
        function adoptRemoteState(remoteState) {
          if (!remoteState?.sessionId || !remoteState?.cwd) return snapshot();
          const active = state.openSessions.find((session) => session.key === state.activeSessionKey);
          const currentCwd = state.currentWorkdir || active?.cwd || state.resumeCandidateSession?.cwd || "";
          const sameThread = state.selectedThread === remoteState.sessionId;
          if (!sameThread && (!currentCwd || comparableSessionPath(currentCwd) !== comparableSessionPath(remoteState.cwd))) {
            return snapshot();
          }
          setOpenSessions(
            state.openSessions.filter((session) => {
              if (!session?.threadId || !session.cwd) return true;
              const sameSessionCwd = comparableSessionPath(session.cwd) === comparableSessionPath(remoteState.cwd);
              if (session.threadId === remoteState.sessionId) return sameSessionCwd;
              return !sameSessionCwd;
            })
          );
          state.selectedThread = remoteState.sessionId;
          state.currentWorkdir = remoteState.cwd;
          return addOrUpdateOpenSession({
            threadId: remoteState.sessionId,
            cwd: remoteState.cwd,
            title: remoteState.sessionId,
            status: remoteState.status || "input_ready"
          });
        }
        function syncFromLiveThreads(threads, options = {}) {
          const titleForThread = typeof options.titleForThread === "function" ? options.titleForThread : (thread) => thread?.id || "";
          const liveThreads = Array.isArray(threads) ? threads.filter(isLiveThreadForOpenSession) : [];
          const liveIds = new Set(liveThreads.map((thread) => thread?.id).filter(Boolean));
          const previousActive = state.openSessions.find((session) => session.key === state.activeSessionKey && session.threadId) || state.resumeCandidateSession || null;
          const known = new Map(state.openSessions.map((item) => [item.threadId, { ...item }]));
          const nextSessions = [];
          for (const thread of liveThreads) {
            if (!thread?.id) continue;
            if (state.closedThreadIds.has(thread.id) && thread.id !== state.selectedThread) continue;
            const existing = known.get(thread.id);
            if (existing) {
              const previousKey = existing.key;
              existing.cwd = thread.cwd || existing.cwd;
              existing.key = sessionKeyFor(existing.threadId, existing.cwd);
              if (state.activeSessionKey === previousKey) state.activeSessionKey = existing.key;
              existing.title = titleForThread(thread);
              existing.status = thread.status || thread.sessionState?.status || existing.status || "ready";
              existing.updatedAt = thread.updatedAt || thread.createdAt || Date.now();
              if (thread.id === state.selectedThread && thread.cwd && state.currentWorkdir !== thread.cwd) {
                state.currentWorkdir = thread.cwd;
              }
              nextSessions.push(existing);
              continue;
            }
            nextSessions.push(
              normalizeOpenSession({
                threadId: thread.id,
                cwd: thread.cwd || "",
                title: titleForThread(thread),
                status: thread.status || thread.sessionState?.status || "ready",
                updatedAt: thread.updatedAt || thread.createdAt || Date.now()
              })
            );
          }
          setOpenSessions(
            nextSessions.filter((session) => session && (!session.threadId || liveIds.has(session.threadId) && !state.closedThreadIds.has(session.threadId)))
          );
          if (previousActive?.threadId && !liveIds.has(previousActive.threadId)) {
            state.resumeCandidateSession = normalizeOpenSession(previousActive);
          }
          if (state.selectedThread && !liveIds.has(state.selectedThread)) {
            const migrationCwd = state.currentWorkdir || previousActive?.cwd || state.resumeCandidateSession?.cwd || "";
            const migratedThreads = liveThreads.filter((thread) => {
              if (!thread?.id || !thread?.cwd) return false;
              return comparableSessionPath(thread.cwd) === comparableSessionPath(migrationCwd);
            });
            if (migratedThreads.length === 1) {
              state.selectedThread = migratedThreads[0].id;
              const migratedSession = state.openSessions.find((session) => session.threadId === state.selectedThread);
              if (migratedSession) state.activeSessionKey = migratedSession.key;
              if (migratedThreads[0].cwd && state.currentWorkdir !== migratedThreads[0].cwd) {
                state.currentWorkdir = migratedThreads[0].cwd;
              }
              state.resumeCandidateSession = normalizeOpenSession(
                migratedSession || {
                  threadId: state.selectedThread,
                  cwd: migratedThreads[0].cwd || migrationCwd,
                  title: titleForThread(migratedThreads[0]),
                  status: migratedThreads[0].status || migratedThreads[0].sessionState?.status || "ready"
                }
              );
            } else {
              state.resumeCandidateSession = normalizeOpenSession({
                threadId: state.selectedThread,
                cwd: migrationCwd,
                title: previousActive?.title || state.selectedThread,
                status: "resume_pending"
              });
            }
          }
          if (!state.activeSessionKey && state.openSessions.length) state.activeSessionKey = state.openSessions[0].key;
          if (state.activeSessionKey && !state.openSessions.some((session) => session.key === state.activeSessionKey) && state.resumeCandidateSession?.key !== state.activeSessionKey) {
            state.activeSessionKey = "";
          }
          return snapshot();
        }
        function activateSession(sessionKey) {
          const session = state.openSessions.find((item) => item.key === sessionKey);
          if (!session) return snapshot();
          state.activeSessionKey = session.key;
          state.selectedThread = session.threadId || "";
          state.currentWorkdir = session.cwd || state.currentWorkdir;
          return snapshot();
        }
        function removeSession(sessionKey) {
          const index = state.openSessions.findIndex((session) => session.key === sessionKey);
          if (index < 0) return snapshot();
          const [removed] = state.openSessions.splice(index, 1);
          rememberClosedThread(removed?.threadId);
          if (removed?.threadId === state.selectedThread) {
            const neighbor = state.openSessions[index] || state.openSessions[Math.max(0, index - 1)] || null;
            state.activeSessionKey = neighbor?.key || "";
            state.selectedThread = neighbor?.threadId || "";
            state.currentWorkdir = neighbor?.cwd || state.currentWorkdir;
          }
          return snapshot();
        }
        function restoreFromLiveThreads(threads) {
          if (state.selectedThread) return snapshot();
          const liveIds = new Set((Array.isArray(threads) ? threads : []).map((thread) => thread?.id).filter(Boolean));
          const saved = state.openSessions.find((session) => session.key === state.activeSessionKey && liveIds.has(session.threadId)) || state.openSessions.find((session) => liveIds.has(session.threadId)) || state.resumeCandidateSession || null;
          if (!saved) return snapshot();
          state.activeSessionKey = saved.key;
          state.selectedThread = saved.threadId || "";
          state.currentWorkdir = saved.cwd || state.currentWorkdir;
          return snapshot();
        }
        function clearSelectedThread() {
          const previousThread = state.selectedThread;
          state.selectedThread = "";
          return { ...snapshot(), previousThread };
        }
        function syncReadyThread(input = {}) {
          if (!input.threadId) return snapshot();
          state.selectedThread = input.threadId;
          if (input.cwd) state.currentWorkdir = input.cwd;
          return addOrUpdateOpenSession({
            threadId: input.threadId,
            cwd: input.cwd || state.currentWorkdir,
            title: input.title || input.threadId,
            status: input.status || "ready"
          });
        }
        function selectLiveThread(thread, options = {}) {
          const titleForThread = typeof options.titleForThread === "function" ? options.titleForThread : (value) => value?.id || "";
          if (!thread?.id) return snapshot();
          state.selectedThread = thread.id;
          const session = addOrUpdateOpenSession({
            threadId: thread.id,
            cwd: thread.cwd || "",
            title: titleForThread(thread),
            status: thread.status || "ready"
          });
          state.activeSessionKey = session.activeSessionKey;
          return snapshot();
        }
        return {
          activateSession,
          addOrUpdateOpenSession,
          adoptRemoteState,
          clearSelectedThread,
          comparableSessionPath,
          forgetClosedThread,
          normalizeOpenSession,
          pinThread,
          rememberClosedThread,
          removeSession,
          restoreFromLiveThreads,
          sessionKeyFor,
          setCurrentWorkdir,
          setResumeCandidate,
          snapshot,
          syncFromLiveThreads,
          syncReadyThread,
          selectLiveThread,
          togglePinnedThread,
          unpinThread,
          updateActiveSessionStatus
        };
      }
      module.exports = {
        comparableSessionPath,
        createSessionStore,
        normalizeClosedThreadIds,
        normalizeOpenSession,
        normalizePinnedThreadIds,
        sessionKeyFor
      };
    }
  });
  return require_browser_session_state();
})();
