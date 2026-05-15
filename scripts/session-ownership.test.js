const test = require("node:test");
const assert = require("node:assert/strict");

const {
  broadcastSessionStateToTargets,
  drainReadyBridgeQueues,
  migrateBridgeThreadOwnership,
  sessionStateFor,
  sessionStateKey,
  sessionStateMatches,
} = require("./server/session-ownership");

test("sessionStateKey prefers session id and falls back to resolved cwd", () => {
  assert.equal(sessionStateKey({ sessionId: "thread-a", cwd: "/tmp/work" }), "session:thread-a");
  assert.match(sessionStateKey({ cwd: "relative-work", defaultCwd: "/tmp/base" }), /^cwd:/);
});

test("sessionStateFor falls back from thread id to cwd alias", () => {
  const sessionStates = new Map();
  const state = { sessionId: "thread-real", cwd: "/tmp/work", status: "running" };
  sessionStates.set(sessionStateKey({ cwd: "/tmp/work" }), state);

  assert.equal(sessionStateFor({ sessionStates, threadId: "thread-old", cwd: "/tmp/work" }), state);
  assert.equal(sessionStateFor({ sessionStates, threadId: "thread-old" }), null);
});

test("sessionStateMatches accepts either session id or cwd", () => {
  const state = { sessionId: "thread-real", cwd: "/tmp/work" };
  assert.equal(sessionStateMatches(state, "thread-real", "/other"), true);
  assert.equal(sessionStateMatches(state, "thread-old", "/tmp/work"), true);
  assert.equal(sessionStateMatches(state, "thread-old", "/other"), false);
});

test("migrateBridgeThreadOwnership rehomes the only same-cwd bridge", () => {
  const aliases = new Map();
  const bridges = new Map();
  const bridge = {
    cwd: "/tmp/work",
    threadId: "thread-old",
    rehomeBridgeKey(nextThreadId) {
      bridges.delete("thread-old");
      bridges.set(nextThreadId, this);
    },
  };
  bridges.set("thread-old", bridge);

  migrateBridgeThreadOwnership({
    state: { sessionId: "thread-real", cwd: "/tmp/work" },
    bridges,
    threadAliases: aliases,
    findLiveBridge: (collection, threadId) => collection.get(threadId) || null,
  });

  assert.equal(bridge.threadId, "thread-real");
  assert.equal(bridges.get("thread-real"), bridge);
  assert.equal(aliases.get("thread-old"), "thread-real");
});

test("migrateBridgeThreadOwnership does not rehome ambiguous same-cwd bridges", () => {
  const aliases = new Map();
  const bridges = new Map([
    ["a", { cwd: "/tmp/work", threadId: "a", rehomeBridgeKey: () => assert.fail("should not rehome") }],
    ["b", { cwd: "/tmp/work", threadId: "b", rehomeBridgeKey: () => assert.fail("should not rehome") }],
  ]);

  migrateBridgeThreadOwnership({
    state: { sessionId: "thread-real", cwd: "/tmp/work" },
    bridges,
    threadAliases: aliases,
    findLiveBridge: (collection, threadId) => collection.get(threadId) || null,
  });

  assert.equal(aliases.size, 0);
});

test("broadcastSessionStateToTargets and drainReadyBridgeQueues target matching sessions", () => {
  const bridgeEvents = [];
  let queueDrains = 0;
  const bridges = new Map([
    [
      "thread-real",
      {
        threadId: "thread-real",
        cwd: "/tmp/work",
        emit: (type, payload) => bridgeEvents.push({ type, payload }),
        noteActivity: () => bridgeEvents.push({ type: "activity" }),
        startNextQueuedTurn: () => {
          queueDrains += 1;
        },
      },
    ],
  ]);
  const terminalEvents = [];
  const terminalSessions = new Map([
    [
      "terminal",
      {
        threadId: "thread-old",
        cwd: "/tmp/work",
        broadcast: (payload) => terminalEvents.push(payload),
        noteActivity: () => terminalEvents.push({ type: "activity" }),
      },
    ],
  ]);
  const state = { sessionId: "thread-real", cwd: "/tmp/work", status: "input_ready" };

  broadcastSessionStateToTargets({ state, bridges, terminalSessions });
  drainReadyBridgeQueues({ state, bridges });

  assert.equal(bridgeEvents[0].type, "activity");
  assert.equal(bridgeEvents[1].type, "sessionState");
  assert.deepEqual(terminalEvents[1], { type: "sessionState", state });
  assert.equal(queueDrains, 1);
});
