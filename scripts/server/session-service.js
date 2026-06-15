const { isSessionBusy, mergeSessionState } = require("../session-state");
const {
  broadcastSessionStateToTargets,
  drainReadyBridgeQueues,
  migrateBridgeThreadOwnership,
  sessionStateFor: findSessionStateFor,
  sessionStateKey,
} = require("./session-ownership");

function createSessionService(options = {}) {
  const {
    bridges,
    defaultCwd = "",
    findLiveBridge,
    sessionStates = new Map(),
    terminalSessions,
    threadAliases,
  } = options;

  function lookupLiveBridge(threadId) {
    if (typeof findLiveBridge !== "function") return null;
    if (findLiveBridge.length >= 2) return findLiveBridge(bridges, threadId);
    return findLiveBridge(threadId);
  }

  function get(threadId, cwd = "") {
    return findSessionStateFor({ sessionStates, threadId, cwd, defaultCwd });
  }

  function list() {
    return Array.from(new Set(sessionStates.values()));
  }

  function update(statePatch) {
    const key = sessionStateKey({ sessionId: statePatch.sessionId, cwd: statePatch.cwd, defaultCwd });
    const previous = sessionStates.get(key);
    const state = mergeSessionState(previous, statePatch);
    sessionStates.set(key, state);
    if (state.cwd) sessionStates.set(sessionStateKey({ cwd: state.cwd, defaultCwd }), state);
    migrateBridgeThreadOwnership({
      state,
      bridges,
      threadAliases,
      findLiveBridge: (_bridges, threadId) => lookupLiveBridge(threadId),
      defaultCwd,
    });
    broadcastSessionStateToTargets({ state, bridges, terminalSessions });
    if (!isSessionBusy(state)) {
      drainReadyBridgeQueues({ state, bridges });
    }
    return state;
  }

  return {
    get,
    list,
    sessionStates,
    update,
  };
}

module.exports = {
  createSessionService,
};
