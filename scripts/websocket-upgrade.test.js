const test = require("node:test");
const assert = require("node:assert/strict");

const { parseWebSocketUpgradeRequest } = require("./server/websocket-upgrade");

function safeDirectoryPath(input, base) {
  if (input === "/home/project") return { absolute: input, base };
  return null;
}

test("parseWebSocketUpgradeRequest rejects unrelated upgrade paths", () => {
  assert.deepEqual(
    parseWebSocketUpgradeRequest({
      defaultWorkdir: "/repo",
      safeDirectoryPath,
      url: new URL("http://local.test/other"),
    }),
    { ok: false, action: "destroy" },
  );
});

test("parseWebSocketUpgradeRequest rejects invalid bridge tokens", () => {
  assert.deepEqual(
    parseWebSocketUpgradeRequest({
      defaultWorkdir: "/repo",
      phoneToken: "secret",
      safeDirectoryPath,
      tokenRequired: true,
      url: new URL("http://local.test/bridge?token=wrong"),
    }),
    { ok: false, action: "http", status: 401, message: "Unauthorized" },
  );
});

test("parseWebSocketUpgradeRequest returns bridge upgrade metadata", () => {
  assert.deepEqual(
    parseWebSocketUpgradeRequest({
      defaultWorkdir: "/repo",
      phoneToken: "secret",
      safeDirectoryPath,
      tokenRequired: true,
      url: new URL("http://local.test/bridge?token=secret&thread=abc&new=1&cwd=/home/project"),
    }),
    {
      ok: true,
      cwd: "/home/project",
      forceNew: true,
      kind: "bridge",
      rows: 30,
      cols: 100,
      threadId: "abc",
    },
  );
});

test("parseWebSocketUpgradeRequest requires thread id for terminal upgrades", () => {
  assert.deepEqual(
    parseWebSocketUpgradeRequest({
      defaultWorkdir: "/repo",
      phoneToken: "secret",
      safeDirectoryPath,
      tokenRequired: true,
      url: new URL("http://local.test/terminal?token=secret"),
    }),
    { ok: false, action: "http", status: 400, message: "Bad Request" },
  );
});

test("parseWebSocketUpgradeRequest returns terminal geometry", () => {
  assert.deepEqual(
    parseWebSocketUpgradeRequest({
      defaultWorkdir: "/repo",
      phoneToken: "secret",
      safeDirectoryPath,
      tokenRequired: true,
      url: new URL("http://local.test/terminal?token=secret&thread=abc&cols=120&rows=40"),
    }),
    {
      ok: true,
      cwd: "/repo",
      forceNew: false,
      kind: "terminal",
      rows: 40,
      cols: 120,
      threadId: "abc",
    },
  );
});
