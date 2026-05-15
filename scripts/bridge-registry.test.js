const assert = require("node:assert/strict");
const test = require("node:test");
const { createBridgeRegistry, resolveThreadAlias } = require("./server/bridge-registry");
const { bridgeKeyForRequest } = require("./bridge-state");

test("resolveThreadAlias follows live aliases and clears stale aliases", () => {
  const threadAliases = new Map([["old", "new"]]);
  assert.equal(resolveThreadAlias({ threadId: "old", threadAliases, findLiveBridge: (threadId) => threadId === "new" }), "new");
  assert.equal(threadAliases.has("old"), true);

  assert.equal(resolveThreadAlias({ threadId: "old", threadAliases, findLiveBridge: () => null }), "old");
  assert.equal(threadAliases.has("old"), false);
});

test("createBridgeRegistry reuses shared startup bridge", () => {
  const bridges = new Map();
  const created = [];
  const registry = createBridgeRegistry({
    bridgeKeyForRequest,
    bridges,
    createBridge: (threadId, key, options) => {
      const bridge = { requestedThreadId: threadId, key, options, dispose() {} };
      created.push(bridge);
      return bridge;
    },
    defaultWorkdir: "/repo",
    findLiveBridge: () => null,
    pruneIdleRetainedSessions: () => {},
    threadAliases: new Map(),
  });

  const first = registry.getBridge(null, "connection-1");
  const second = registry.getBridge(null, "connection-2");

  assert.equal(first, second);
  assert.equal(created.length, 1);
  assert.equal(first.key, "new:shared");
  assert.equal(first.options.cwd, "/repo");
});

test("createBridgeRegistry creates forced new bridge and reuses live existing bridge", () => {
  const bridges = new Map();
  const live = { requestedThreadId: "thread-1", dispose() {} };
  const registry = createBridgeRegistry({
    bridgeKeyForRequest,
    bridges,
    createBridge: (threadId, key, options) => ({ requestedThreadId: threadId, key, options, dispose() {} }),
    defaultWorkdir: "/repo",
    findLiveBridge: (threadId) => (threadId === "thread-1" ? live : null),
    pruneIdleRetainedSessions: () => {},
    threadAliases: new Map(),
  });

  assert.equal(registry.getBridge("thread-1", "connection-1"), live);
  const forced = registry.getBridge(null, "connection-2", { forceNew: true, cwd: "/other" });
  assert.equal(forced.key, "new:connection-2");
  assert.equal(forced.options.cwd, "/other");
});
