const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable, Writable } = require("stream");

const { createApiRoutes } = require("./server/api-routes");

class CaptureResponse extends Writable {
  constructor() {
    super();
    this.statusCode = null;
    this.headers = null;
    this.chunks = [];
  }

  writeHead(statusCode, headers = {}) {
    this.statusCode = statusCode;
    this.headers = headers;
  }

  _write(chunk, _encoding, callback) {
    this.chunks.push(Buffer.from(chunk));
    callback();
  }

  body() {
    return Buffer.concat(this.chunks).toString("utf8");
  }

  json() {
    return JSON.parse(this.body());
  }
}

function baseDeps(overrides = {}) {
  const sendJson = (res, status, body) => {
    res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(body));
  };
  return {
    appServerRequest: async () => ({}),
    authMode: "token",
    bridges: new Map(),
    codexPort: 45213,
    codexSocketPath: "",
    codexUrl: "ws://127.0.0.1:45213",
    discoverArtifacts: () => [],
    discoverWorkspaceEntries: async () => [],
    findLiveBridge: () => null,
    historyFromThread: () => [],
    historySyncEnabled: true,
    isImagePath: () => false,
    liveThreadSummaries: () => [],
    mimeForPath: () => "application/octet-stream",
    model: "gpt-test",
    normalizeHookState: (payload) => payload,
    readAutomations: () => [],
    readDirectoryListing: () => null,
    readJsonBody: async (req) => {
      const chunks = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    },
    readSkills: () => [],
    readThreadSnapshot: async () => ({}),
    relativeDisplayPath: (target) => target,
    requireToken: (url, phoneToken, res) => {
      if (url.searchParams.get("token") === phoneToken) return true;
      sendJson(res, 401, { error: "invalid token" });
      return false;
    },
    reviewSummary: async () => ({}),
    runHistorySync: async () => ({}),
    safeDirectoryPath: () => null,
    safeOpenPath: () => null,
    safeUploadPath: () => null,
    sendJson,
    sessionStateFor: () => null,
    sessionStates: new Map(),
    shouldStartCodexServer: false,
    tokenRequired: true,
    uiPort: 45214,
    updateSessionState: (state) => state,
    workdir: "/tmp/work",
    ...overrides,
  };
}

test("handleApiRequest returns public api info without a token", async () => {
  const { handleApiRequest } = createApiRoutes(baseDeps());
  const res = new CaptureResponse();

  const handled = await handleApiRequest(
    Readable.from([]),
    res,
    new URL("http://local.test/api/info"),
    "secret",
  );

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), {
    model: "gpt-test",
    workdir: "/tmp/work",
    codexUrl: "ws://127.0.0.1:45213",
    codexSocketPath: null,
    managedCodexServer: false,
    tokenRequired: true,
    authMode: "token",
  });
});

test("handleApiRequest enforces token checks for protected routes", async () => {
  const { handleApiRequest } = createApiRoutes(baseDeps());
  const res = new CaptureResponse();

  const handled = await handleApiRequest(
    Readable.from([]),
    res,
    new URL("http://local.test/api/status"),
    "secret",
  );

  assert.equal(handled, true);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.json(), { error: "invalid token" });
});

test("handleApiRequest applies hook token and updates session state", async () => {
  const seen = [];
  const { handleApiRequest } = createApiRoutes(baseDeps({
    updateSessionState: (state) => {
      seen.push(state);
      return { ...state, stored: true };
    },
  }));
  const res = new CaptureResponse();
  const req = Readable.from(['{"session_id":"thread-a","event":"Stop"}']);
  req.method = "POST";
  req.headers = { "x-codex-remote-hook-token": "secret" };

  const handled = await handleApiRequest(req, res, new URL("http://local.test/api/codex-hook"), "secret");

  assert.equal(handled, true);
  assert.deepEqual(seen, [{ session_id: "thread-a", event: "Stop" }]);
  assert.deepEqual(res.json(), { ok: true, state: { session_id: "thread-a", event: "Stop", stored: true } });
});
