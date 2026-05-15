const path = require("path");

function sessionStateKey({ sessionId, cwd = "", defaultCwd = "" } = {}) {
  if (sessionId) return `session:${sessionId}`;
  return `cwd:${path.resolve(cwd || defaultCwd || ".")}`;
}

function sessionStateFor({ sessionStates, threadId, cwd = "", defaultCwd = "" } = {}) {
  const direct = sessionStates.get(sessionStateKey({ sessionId: threadId, cwd, defaultCwd }));
  if (direct) return direct;
  if (!cwd) return null;
  return sessionStates.get(sessionStateKey({ cwd, defaultCwd })) || null;
}

function sessionStateMatches(state, threadId, cwd = "") {
  if (!state) return false;
  if (threadId && state.sessionId && state.sessionId === threadId) return true;
  if (cwd && state.cwd && path.resolve(state.cwd) === path.resolve(cwd)) return true;
  return false;
}

function broadcastSessionStateToTargets({ state, bridges, terminalSessions } = {}) {
  for (const bridge of bridges.values()) {
    if (!sessionStateMatches(state, bridge.threadId || bridge.requestedThreadId, bridge.cwd)) continue;
    bridge.noteActivity?.();
    bridge.emit("sessionState", { state });
  }
  for (const session of terminalSessions.values()) {
    if (!sessionStateMatches(state, session.threadId, session.cwd)) continue;
    session.noteActivity?.();
    session.broadcast({ type: "sessionState", state });
  }
}

function migrateBridgeThreadOwnership({ state, bridges, threadAliases, findLiveBridge, defaultCwd = "" } = {}) {
  if (!state?.sessionId || !state?.cwd) return;
  const directBridge = findLiveBridge(bridges, state.sessionId);
  if (directBridge) {
    const nextCwd = path.resolve(state.cwd);
    if (path.resolve(directBridge.cwd || defaultCwd) !== nextCwd) {
      directBridge.cwd = nextCwd;
      directBridge.updatedAt = Date.now();
    }
    return;
  }
  const sameCwdBridges = Array.from(bridges.values()).filter((bridge) => {
    if (!bridge?.cwd) return false;
    return path.resolve(bridge.cwd) === path.resolve(state.cwd);
  });
  if (sameCwdBridges.length !== 1) return;
  const [bridge] = sameCwdBridges;
  if (!bridge) return;
  if (bridge.threadId === state.sessionId) {
    bridge.rehomeBridgeKey?.(state.sessionId);
    return;
  }
  const previousThreadId = bridge.threadId;
  bridge.threadId = state.sessionId;
  bridge.rehomeBridgeKey?.(state.sessionId);
  if (previousThreadId) threadAliases.set(previousThreadId, state.sessionId);
}

function drainReadyBridgeQueues({ state, bridges } = {}) {
  for (const bridge of bridges.values()) {
    if (sessionStateMatches(state, bridge.threadId || bridge.requestedThreadId, bridge.cwd)) bridge.startNextQueuedTurn?.();
  }
}

module.exports = {
  broadcastSessionStateToTargets,
  drainReadyBridgeQueues,
  migrateBridgeThreadOwnership,
  sessionStateFor,
  sessionStateKey,
  sessionStateMatches,
};
