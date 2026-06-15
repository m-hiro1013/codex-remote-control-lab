const test = require("node:test");
const assert = require("node:assert/strict");

const { createSessionStore } = require("./browser-session-state");

const root = "/tmp/project";

function titleForThread(thread) {
  return `title:${thread.id}`;
}

test("session store adopts canonical remote state for the same cwd", () => {
  const store = createSessionStore({
    selectedThread: "thread-old",
    currentWorkdir: root,
    openSessions: [
      { threadId: "thread-old", cwd: root, title: "old" },
      { threadId: "thread-stale", cwd: root, title: "stale" },
    ],
    activeSessionKey: `thread-old::${root}`,
    resumeCandidateSession: { threadId: "thread-old", cwd: root, title: "old" },
  });

  const next = store.adoptRemoteState({
    sessionId: "thread-new",
    cwd: root,
    status: "running",
  });

  assert.equal(next.selectedThread, "thread-new");
  assert.equal(next.currentWorkdir, root);
  assert.equal(next.activeSessionKey, `thread-new::${root}`);
  assert.deepEqual(
    next.openSessions.map((session) => ({ threadId: session.threadId, cwd: session.cwd, status: session.status })),
    [{ threadId: "thread-new", cwd: root, status: "running" }],
  );
  assert.equal(next.resumeCandidateSession?.threadId, "thread-new");
});

test("session store migrates selected thread to the only live thread with the same cwd", () => {
  const store = createSessionStore({
    selectedThread: "thread-old",
    currentWorkdir: root,
    openSessions: [{ threadId: "thread-old", cwd: root, title: "old" }],
    activeSessionKey: `thread-old::${root}`,
    resumeCandidateSession: { threadId: "thread-old", cwd: root, title: "old" },
  });

  const next = store.syncFromLiveThreads(
    [{ id: "thread-new", cwd: root, status: "input_ready", updatedAt: 10 }],
    { titleForThread },
  );

  assert.equal(next.selectedThread, "thread-new");
  assert.equal(next.activeSessionKey, `thread-new::${root}`);
  assert.deepEqual(next.openSessions.map((session) => session.threadId), ["thread-new"]);
  assert.equal(next.resumeCandidateSession?.threadId, "thread-new");
  assert.equal(next.resumeCandidateSession?.cwd, root);
});

test("session store keeps a resume candidate when the live thread is temporarily missing", () => {
  const store = createSessionStore({
    selectedThread: "thread-missing",
    currentWorkdir: root,
    openSessions: [{ threadId: "thread-missing", cwd: root, title: "missing" }],
    activeSessionKey: `thread-missing::${root}`,
  });

  const next = store.syncFromLiveThreads([], { titleForThread });

  assert.equal(next.selectedThread, "thread-missing");
  assert.equal(next.resumeCandidateSession?.threadId, "thread-missing");
  assert.equal(next.resumeCandidateSession?.status, "resume_pending");
});
