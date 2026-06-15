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

test("handleApiRequest lists normalized history threads with limit and cursor", async () => {
  const calls = [];
  const { handleApiRequest } = createApiRoutes(baseDeps({
    appServerRequest: async (method, params) => {
      calls.push({ method, params });
      return {
        threads: [{ id: "thread-a", cwd: "/repo", preview: "hello", updatedAt: 10 }],
        nextCursor: "next-page",
      };
    },
    summarizeHistoryThreads: (result) => result.threads.map((thread) => ({ ...thread, source: "history", status: "idle" })),
  }));
  const res = new CaptureResponse();

  const handled = await handleApiRequest(
    Readable.from([]),
    res,
    new URL("http://local.test/api/threads?token=secret&limit=150&cursor=abc"),
    "secret",
  );

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls, [
    {
      method: "thread/list",
      params: {
        limit: 150,
        cursor: "abc",
        sortKey: "updated_at",
        sortDirection: "desc",
        archived: false,
        useStateDbOnly: false,
      },
    },
  ]);
  assert.deepEqual(res.json(), {
    threads: [{ id: "thread-a", cwd: "/repo", preview: "hello", updatedAt: 10 }],
    nextCursor: "next-page",
    data: [{ id: "thread-a", cwd: "/repo", preview: "hello", updatedAt: 10, source: "history", status: "idle" }],
  });
});

test("handleApiRequest reads thread goals from the live bridge without unsupported RPCs", async () => {
  const calls = [];
  const goal = {
    threadId: "thread-a",
    objective: "ship it",
    status: "in_progress",
    tokensUsed: 42,
  };
  const { handleApiRequest } = createApiRoutes(baseDeps({
    appServerRequest: async (method, params) => {
      calls.push({ method, params });
      return {};
    },
    findLiveBridge: (_bridges, threadId) => (threadId === "thread-a" ? { threadId, goal } : null),
  }));
  const getRes = new CaptureResponse();

  await handleApiRequest(Readable.from([]), getRes, new URL("http://local.test/api/goal?token=secret&thread=thread-a"), "secret");

  assert.deepEqual(calls, []);
  assert.equal(getRes.statusCode, 200);
  assert.deepEqual(getRes.json(), { supported: true, readOnly: true, goal });
});

test("handleApiRequest rejects goal writes because goals are updated by app-server notifications", async () => {
  const calls = [];
  const { handleApiRequest } = createApiRoutes(baseDeps({
    appServerRequest: async (method, params) => {
      calls.push({ method, params });
      return {};
    },
  }));
  const res = new CaptureResponse();
  const req = Readable.from([JSON.stringify({ thread: "thread-a", goal: "ship it" })]);
  req.method = "POST";

  await handleApiRequest(req, res, new URL("http://local.test/api/goal?token=secret"), "secret");

  assert.deepEqual(calls, []);
  assert.equal(res.statusCode, 405);
  assert.deepEqual(res.json(), { supported: true, readOnly: true, error: "goal is read-only" });
});
