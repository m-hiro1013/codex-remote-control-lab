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
    materialized: true,
    sessionState: { status: "input_ready" },
  });
});

test("SharedBridge sends prompt turns and records running state", () => {
  const { bridges, SharedBridge, stateUpdates, upstream } = createBridgeHarness();
  const bridge = new SharedBridge(null, "new:two");
  bridges.set("new:two", bridge);
  bridge.threadId = "thread-2";
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

test("SharedBridge maps approval decisions to upstream payloads", () => {
  const { SharedBridge, upstream } = createBridgeHarness();
  const bridge = new SharedBridge(null, "new:three");

  bridge.approval({ id: "approval-1", method: "item/fileChange/requestApproval" }, "accept");

  assert.deepEqual(upstream.sent.at(-1), { id: "approval-1", result: { decision: "accept" } });
});
