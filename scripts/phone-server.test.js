const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const test = require("node:test");
const { createPhoneHttpServer } = require("./server/phone-server");

function createHarness(overrides = {}) {
  const calls = [];
  const server = new EventEmitter();
  let requestHandler;
  const wss = {
    handleUpgrade(req, socket, head, callback) {
      calls.push(["handleUpgrade", req.url, socket, head]);
      callback({ ws: true });
    },
  };
  const result = createPhoneHttpServer({
    bindBrowser: (ws, token, threadId, options) => calls.push(["bindBrowser", ws, token, threadId, options]),
    bindTerminalSocket: (ws, options) => calls.push(["bindTerminalSocket", ws, options]),
    createHttpServer: (handler) => {
      requestHandler = handler;
      return server;
    },
    createWebSocketServer: () => wss,
    defaultWorkdir: "/repo",
    handleApiRequest: async () => false,
    parseWebSocketUpgradeRequest: () => ({ ok: false, status: 404, body: "bad" }),
    phoneToken: "token",
    safeDirectoryPath: () => "/repo",
    serveStatic: (req, res) => calls.push(["serveStatic", req.url, res]),
    tokenRequired: true,
    writeUpgradeRejection: (socket, upgrade) => calls.push(["writeUpgradeRejection", socket, upgrade]),
    ...overrides,
  });
  return { calls, requestHandler, result, server, wss };
}

test("createPhoneHttpServer routes API requests before static files", async () => {
  const calls = [];
  const { requestHandler } = createHarness({
    handleApiRequest: async (req, res, url, token) => {
      calls.push(["api", req.url, url.pathname, token]);
      return true;
    },
    serveStatic: () => calls.push(["static"]),
  });

  await requestHandler({ url: "/api/status", headers: { host: "localhost" } }, {});

  assert.deepEqual(calls, [["api", "/api/status", "/api/status", "token"]]);
});

test("createPhoneHttpServer serves static files when API does not handle the request", async () => {
  const { calls, requestHandler } = createHarness();

  await requestHandler({ url: "/", headers: { host: "localhost" } }, { res: true });

  assert.deepEqual(calls, [["serveStatic", "/", { res: true }]]);
});

test("createPhoneHttpServer rejects invalid websocket upgrades", () => {
  const { calls, server } = createHarness({
    parseWebSocketUpgradeRequest: () => ({ ok: false, status: 401, body: "invalid" }),
  });

  server.emit("upgrade", { url: "/bridge", headers: { host: "localhost" } }, { socket: true }, Buffer.alloc(0));

  assert.deepEqual(calls, [["writeUpgradeRejection", { socket: true }, { ok: false, status: 401, body: "invalid" }]]);
});

test("createPhoneHttpServer binds terminal websocket upgrades", () => {
  const { calls, server } = createHarness({
    parseWebSocketUpgradeRequest: () => ({ ok: true, kind: "terminal", threadId: "t1", cwd: "/repo", cols: 80, rows: 24 }),
  });

  server.emit("upgrade", { url: "/terminal", headers: { host: "localhost" } }, { socket: true }, Buffer.from("head"));

  assert.deepEqual(calls, [
    ["handleUpgrade", "/terminal", { socket: true }, Buffer.from("head")],
    ["bindTerminalSocket", { ws: true }, { threadId: "t1", cwd: "/repo", cols: 80, rows: 24 }],
  ]);
});

test("createPhoneHttpServer binds browser websocket upgrades", () => {
  const { calls, server } = createHarness({
    parseWebSocketUpgradeRequest: () => ({ ok: true, kind: "bridge", threadId: "t2", cwd: "/repo", forceNew: true }),
  });

  server.emit("upgrade", { url: "/bridge", headers: { host: "localhost" } }, { socket: true }, Buffer.alloc(0));

  assert.deepEqual(calls, [
    ["handleUpgrade", "/bridge", { socket: true }, Buffer.alloc(0)],
    ["bindBrowser", { ws: true }, "token", "t2", { forceNew: true, cwd: "/repo" }],
  ]);
});
