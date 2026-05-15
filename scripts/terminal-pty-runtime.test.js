const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("events");

const { createTerminalPtyRuntime } = require("./server/terminal-pty-runtime");

function createFakeProc() {
  const proc = {
    writes: [],
    resizes: [],
    killed: false,
    onDataHandler: null,
    onExitHandler: null,
    onData(handler) {
      this.onDataHandler = handler;
    },
    onExit(handler) {
      this.onExitHandler = handler;
    },
    write(data) {
      this.writes.push(data);
    },
    resize(cols, rows) {
      this.resizes.push({ cols, rows });
    },
    kill() {
      this.killed = true;
    },
  };
  return proc;
}

function createRuntime(overrides = {}) {
  const proc = createFakeProc();
  const terminalSessions = new Map();
  const runtime = createTerminalPtyRuntime({
    codexTerminalBin: "codex",
    codexUrl: "ws://127.0.0.1:45213",
    createIdleRetentionTimer: (callback) => {
      const timer = setTimeout(callback, 1);
      timer.unref?.();
      return timer;
    },
    defaultWorkdir: "/tmp/work",
    env: {},
    findLiveBridge: () => null,
    pruneIdleRetainedSessions: () => {},
    pty: {
      spawn: () => proc,
    },
    remoteHookEnv: () => ({}),
    retainedSessionConfig: { idleTtlMs: 1000, maxSessions: 10 },
    sessionStateFor: () => null,
    shouldDisposeIdleBridge: ({ clientCount }) => clientCount === 0,
    shouldScheduleIdleCleanup: ({ clientCount }) => clientCount === 0,
    terminalSessions,
    webSocketOpenState: 1,
    ...overrides,
  });
  return { proc, runtime, terminalSessions };
}

test("TerminalPtySession forwards terminal input and resize messages", () => {
  const { proc, runtime } = createRuntime();
  const session = runtime.getTerminalSession({ threadId: "thread-a", cwd: "/tmp/work", cols: 80, rows: 24 });
  const ws = new EventEmitter();
  ws.readyState = 1;
  ws.sent = [];
  ws.send = (payload) => ws.sent.push(JSON.parse(payload));

  session.addClient(ws);
  ws.emit("message", Buffer.from(JSON.stringify({ type: "input", data: "hello" })));
  ws.emit("message", Buffer.from(JSON.stringify({ type: "resize", cols: 120, rows: 40 })));

  assert.deepEqual(proc.writes, ["hello"]);
  assert.deepEqual(proc.resizes, [{ cols: 120, rows: 40 }]);
  assert.equal(ws.sent[0].type, "status");
});

test("TerminalPtySession blocks non-interrupt input while hook state is running", () => {
  const { proc, runtime } = createRuntime({
    sessionStateFor: () => ({ status: "running" }),
  });
  const session = runtime.getTerminalSession({ threadId: "thread-a", cwd: "/tmp/work" });
  const ws = new EventEmitter();
  ws.readyState = 1;
  ws.sent = [];
  ws.send = (payload) => ws.sent.push(JSON.parse(payload));

  session.addClient(ws);
  ws.emit("message", Buffer.from(JSON.stringify({ type: "input", data: "blocked" })));
  ws.emit("message", Buffer.from(JSON.stringify({ type: "input", data: "\u0003" })));

  assert.deepEqual(proc.writes, ["\u0003"]);
  assert.ok(ws.sent.some((message) => message.text?.includes("一時停止")));
});
