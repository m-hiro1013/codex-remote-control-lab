const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const test = require("node:test");
const { createSharedBridgeClass } = require("./server/shared-bridge");

function createFakeUpstream() {
  const upstream = new EventEmitter();
  upstream.sent = [];
  upstream.closed = false;
  upstream.send = (body) => upstream.sent.push(JSON.parse(body));
  upstream.close = () => {
    upstream.closed = true;
  };
  return upstream;
}

function createFakeBrowser() {
  const browser = new EventEmitter();
  browser.readyState = 1;
  browser.sent = [];
  browser.send = (body) => browser.sent.push(JSON.parse(body));
  browser.close = () => browser.emit("close");
  return browser;
}

function createBridgeHarness(overrides = {}) {
  const bridges = new Map();
  const upstream = createFakeUpstream();
  const stateUpdates = [];
  const SharedBridge = createSharedBridgeClass({
    approvalResponseFor: (request, decision) => ({ id: request.id, result: { decision } }),
    appServerRequest: async () => ({}),
    bridges,
    capHistory: (history) => history,
    createIdleRetentionTimer: () => ({ unref() {} }),
    createUpstreamWebSocket: () => upstream,
    defaultWorkdir: "/repo",
    historyFromThread: () => [{ type: "assistant", text: "loaded history" }],
    historySyncEnabled: false,
    isSessionBusy: () => false,
    model: "gpt-test",
    prepareTurnStart: ({ threadId, text }) => ({
      requestParams: { threadId, input: [{ type: "text", text, text_elements: [] }] },
      displayText: text,
      savedImages: [],
    }),
    pruneIdleRetainedSessions: () => {},
    retainedSessionConfig: { idleTtlMs: 1000 },
    runHistorySync: async () => ({ skipped: true }),
    sandboxPolicyForMode: () => ({}),
    saveDataUrlAttachment: () => null,
    sessionStateFor: () => ({ status: "input_ready" }),
    shouldDisposeIdleBridge: () => false,
    shouldPromoteBridgeKey: () => true,
    shouldScheduleIdleCleanup: () => false,
    summarizeItem: (item) => item.summary || null,
    summarizeLiveItem: () => "",
    updateSessionState: (state) => stateUpdates.push(state),
    webSocketOpenState: 1,
    ...overrides,
  });
  return { bridges, SharedBridge, stateUpdates, upstream };
}

test("SharedBridge starts a thread and emits ready payload", () => {
  const { bridges, SharedBridge, upstream } = createBridgeHarness();
  const bridge = new SharedBridge(null, "new:one");
  bridges.set("new:one", bridge);
  const browser = createFakeBrowser();

  bridge.addClient(browser);
  upstream.emit("open");

  assert.deepEqual(upstream.sent.slice(0, 3), [
    { id: 1, method: "initialize", params: { clientInfo: { name: "codex-phone-bridge", title: "Codex Phone Bridge", version: "0.1.0" } } },
    { method: "initialized", params: {} },
    { id: 2, method: "thread/start", params: { model: "gpt-test", cwd: "/repo", approvalPolicy: "on-request", sandbox: "workspace-write" } },
  ]);

  upstream.emit("message", Buffer.from(JSON.stringify({ id: 2, result: { thread: { id: "thread-1", turns: [] } } })));

  assert.equal(bridge.ready, true);
  assert.equal(bridges.get("thread-1"), bridge);
  assert.deepEqual(browser.sent.at(-1), {
    type: "ready",
    threadId: "thread-1",
    model: "gpt-test",
    workdir: "/repo",
    shared: true,
    clients: 1,
    history: [{ type: "assistant", text: "loaded history" }],
    goal: null,
    materialized: true,
    sessionState: { status: "input_ready" },
  });
});

test("SharedBridge stores goal notifications and includes them in ready payload", () => {
  const { SharedBridge, upstream } = createBridgeHarness();
  const bridge = new SharedBridge(null, "new:goal");
  bridge.threadId = "thread-goal";
  bridge.upstreamThreadId = "thread-goal";
  bridge.ready = true;
  const browser = createFakeBrowser();
  bridge.addClient(browser);

  const goal = {
    threadId: "thread-goal",
    objective: "ship the mobile review surface",
    status: "in_progress",
    tokensUsed: 120,
    timeUsedSeconds: 30,
    updatedAt: "2026-06-15T00:00:00.000Z",
  };
  upstream.emit("message", Buffer.from(JSON.stringify({ method: "thread/goal/updated", params: { goal } })));

  assert.deepEqual(bridge.goal, goal);
  assert.deepEqual(browser.sent.at(-1), { type: "goal", goal });

  const nextBrowser = createFakeBrowser();
  bridge.addClient(nextBrowser);
  assert.equal(nextBrowser.sent.at(-1).type, "ready");
  assert.deepEqual(nextBrowser.sent.at(-1).goal, goal);
});

test("SharedBridge clears goal notifications for the active thread", () => {
  const { SharedBridge, upstream } = createBridgeHarness();
  const bridge = new SharedBridge(null, "new:goal-clear");
  bridge.threadId = "thread-goal";
  bridge.upstreamThreadId = "thread-goal";
  bridge.ready = true;
  bridge.goal = { threadId: "thread-goal", objective: "old goal", status: "in_progress" };
  const browser = createFakeBrowser();
  bridge.addClient(browser);

  upstream.emit("message", Buffer.from(JSON.stringify({ method: "thread/goal/cleared", params: { threadId: "thread-goal" } })));

  assert.equal(bridge.goal, null);
  assert.deepEqual(browser.sent.at(-1), { type: "goal", goal: null });
});

test("SharedBridge sends prompt turns and records running state", () => {
  const { bridges, SharedBridge, stateUpdates, upstream } = createBridgeHarness();
  const bridge = new SharedBridge(null, "new:two");
  bridges.set("new:two", bridge);
  bridge.threadId = "thread-2";
  bridge.upstreamThreadId = "thread-2";
  bridge.ready = true;

  bridge.prompt("hello");
  assert.deepEqual(upstream.sent.at(-1), {
    id: 1,
    method: "turn/start",
    params: { threadId: "thread-2", input: [{ type: "text", text: "hello", text_elements: [] }] },
  });

  upstream.emit("message", Buffer.from(JSON.stringify({ id: 1, result: { turn: { id: "turn-1" } } })));
  assert.deepEqual(stateUpdates.at(-1), {
    source: "app-server",
    status: "running",
    label: "Codex 処理中",
    busy: true,
    completed: false,
    sessionId: "thread-2",
    turnId: "turn-1",
    cwd: "/repo",
    event: "turn/start",
    updatedAt: stateUpdates.at(-1).updatedAt,
  });
});

test("SharedBridge resumes adopted thread before queued prompt", () => {
  const { bridges, SharedBridge, upstream } = createBridgeHarness();
  const bridge = new SharedBridge(null, "thread-old");
  bridges.set("thread-old", bridge);
  bridge.threadId = "thread-old";
  bridge.upstreamThreadId = "thread-old";
  bridge.ready = true;

  bridge.resumeThread("thread-new", { cwd: "/repo" });
  bridge.prompt("after resume");

  assert.deepEqual(upstream.sent.at(-1), {
    id: 1,
    method: "thread/resume",
    params: {
      threadId: "thread-new",
      model: "gpt-test",
      cwd: "/repo",
      approvalPolicy: "on-request",
      sandbox: "workspace-write",
    },
  });
  assert.equal(upstream.sent.some((message) => message.method === "turn/start"), false);

  upstream.emit("message", Buffer.from(JSON.stringify({ id: 1, result: { thread: { id: "thread-new", turns: [] } } })));

  assert.deepEqual(upstream.sent.at(-1), {
    id: 2,
    method: "turn/start",
    params: { threadId: "thread-new", input: [{ type: "text", text: "after resume", text_elements: [] }] },
  });
});

test("SharedBridge maps approval decisions to upstream payloads", () => {
  const { SharedBridge, upstream } = createBridgeHarness();
  const bridge = new SharedBridge(null, "new:three");

  bridge.approval({ id: "approval-1", method: "item/fileChange/requestApproval" }, "accept");

  assert.deepEqual(upstream.sent.at(-1), { id: "approval-1", result: { decision: "accept" } });
});
