const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

function startHookServer(expectedToken) {
  const requests = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      requests.push({
        method: req.method,
        url: req.url,
        token: req.headers["x-codex-remote-hook-token"],
        body: JSON.parse(body || "{}"),
      });
      res.writeHead(req.headers["x-codex-remote-hook-token"] === expectedToken ? 200 : 401, {
        "content-type": "application/json",
      });
      res.end(JSON.stringify({ ok: true }));
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({
        url: `http://127.0.0.1:${server.address().port}/api/codex-hook`,
        requests,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

function runHook(rootDir, payload) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, CODEX_REMOTE_CONTROL_LAB_ROOT: rootDir };
    delete env.CODEX_REMOTE_HOOK_URL;
    delete env.CODEX_REMOTE_HOOK_TOKEN;
    delete env.CODEX_REMOTE_HOOK_CONTINUE;
    const child = spawn(process.execPath, ["scripts/codex-remote-control-state-hook.js"], {
      cwd: root,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("exit", (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(JSON.stringify(payload));
  });
}

test("remote control state hook reads runtime URL and token file when Codex hook env is missing", async () => {
  const token = "fallback-token";
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-remote-hook-"));
  fs.mkdirSync(path.join(tempRoot, ".logs"), { recursive: true });
  fs.writeFileSync(path.join(tempRoot, ".phone-token"), `${token}\n`, { mode: 0o600 });
  const server = await startHookServer(token);
  try {
    fs.writeFileSync(
      path.join(tempRoot, ".logs", "remote-control-hook-runtime.json"),
      `${JSON.stringify({ url: server.url })}\n`,
      { mode: 0o600 },
    );

    const result = await runHook(tempRoot, {
      hook_event_name: "UserPromptSubmit",
      session_id: "session-fallback",
      cwd: root,
    });

    assert.equal(result.code, 0);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, "");
    assert.equal(server.requests.length, 1);
    assert.equal(server.requests[0].method, "POST");
    assert.equal(server.requests[0].url, "/api/codex-hook");
    assert.equal(server.requests[0].token, token);
    assert.equal(server.requests[0].body.session_id, "session-fallback");

    const debugLog = fs.readFileSync(path.join(tempRoot, ".logs", "remote-control-hook.debug.log"), "utf8");
    assert.match(debugLog, /"urlSource":"runtime"/);
    assert.match(debugLog, /"tokenSource":"file"/);
    assert.match(debugLog, /"posted":true/);
  } finally {
    await server.close();
  }
});
