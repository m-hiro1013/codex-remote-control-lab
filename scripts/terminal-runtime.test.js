const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isTerminalInterruptInput,
  terminalCodexArgs,
  terminalKeyFor,
} = require("./server/terminal-runtime");

test("terminalKeyFor scopes sessions by thread and resolved cwd", () => {
  assert.match(terminalKeyFor("thread-a", "relative", "/tmp/base"), /^thread-a:/);
  assert.equal(terminalKeyFor("", "/tmp/work"), "new:/tmp/work");
});

test("terminalCodexArgs includes remote app-server URL unless Unix socket mode is active", () => {
  assert.deepEqual(
    terminalCodexArgs({
      threadId: "thread-a",
      cwd: "/tmp/work",
      codexUrl: "ws://127.0.0.1:45213",
      codexSocketPath: "",
    }),
    ["resume", "--remote", "ws://127.0.0.1:45213", "-C", "/tmp/work", "thread-a"],
  );
  assert.deepEqual(
    terminalCodexArgs({
      threadId: "thread-a",
      cwd: "/tmp/work",
      codexUrl: "ws://codex-app-server/rpc",
      codexSocketPath: "/tmp/codex.sock",
    }),
    ["resume", "-C", "/tmp/work", "thread-a"],
  );
});

test("isTerminalInterruptInput recognizes escape and Ctrl-C only", () => {
  assert.equal(isTerminalInterruptInput("\u001b"), true);
  assert.equal(isTerminalInterruptInput("hello\u0003"), true);
  assert.equal(isTerminalInterruptInput("hello"), false);
});
