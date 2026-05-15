function resolveThreadAlias({ threadId, threadAliases, findLiveBridge }) {
  let current = threadId;
  const visited = new Set();
  while (current && threadAliases.has(current) && !visited.has(current)) {
    visited.add(current);
    current = threadAliases.get(current);
  }
  if (!current || current === threadId) return threadId;
  if (findLiveBridge(current)) return current;
  threadAliases.delete(threadId);
  return threadId;
}

function createBridgeRegistry({
  bridgeKeyForRequest,
  bridges,
  createBridge,
  defaultWorkdir,
  findLiveBridge,
  pruneIdleRetainedSessions,
  threadAliases,
}) {
  function getBridge(threadId, connectionId, options = {}) {
    const canonicalThreadId = resolveThreadAlias({ threadId, threadAliases, findLiveBridge });
    if (!threadId && !options.forceNew) {
      for (const bridge of bridges.values()) {
        if (!bridge.requestedThreadId) return bridge;
      }
    }
    const existing = findLiveBridge(canonicalThreadId);
    if (existing) return existing;
    const key = options.forceNew && !canonicalThreadId ? `new:${connectionId}` : bridgeKeyForRequest(canonicalThreadId, connectionId);
    if (!bridges.has(key)) bridges.set(key, createBridge(canonicalThreadId, key, { cwd: options.cwd || defaultWorkdir }));
    pruneIdleRetainedSessions(bridges, (bridge) => bridge.dispose());
    return bridges.get(key);
  }

  return {
    getBridge,
    resolveThreadAlias: (threadId) => resolveThreadAlias({ threadId, threadAliases, findLiveBridge }),
  };
}

module.exports = {
  createBridgeRegistry,
  resolveThreadAlias,
};
