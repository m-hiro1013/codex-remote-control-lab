const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { Readable, Writable } = require("stream");
const { once } = require("events");

const { createHttpSurface } = require("./server/http-surface");

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
}

test("requireToken writes a JSON 401 when token protection is enabled", () => {
  const { requireToken } = createHttpSurface({ publicRoot: os.tmpdir(), tokenRequired: true });
  const res = new CaptureResponse();
  const ok = requireToken(new URL("http://local.test/api/status"), "secret", res);

  assert.equal(ok, false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.headers["content-type"], "application/json; charset=utf-8");
  assert.deepEqual(JSON.parse(res.body()), { error: "invalid token" });
});

test("readJsonBody parses JSON and enforces the body size limit", async () => {
  const { readJsonBody } = createHttpSurface({ publicRoot: os.tmpdir() });

  assert.deepEqual(await readJsonBody(Readable.from(['{"ok":true}'])), { ok: true });
  await assert.rejects(readJsonBody(Readable.from(["too-large"]), 4), /request body too large/);
});

test("serveStatic serves files from the configured public root", async () => {
  const publicRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-http-surface-"));
  fs.writeFileSync(path.join(publicRoot, "index.html"), "<main>ok</main>", "utf8");
  const { serveStatic } = createHttpSurface({
    publicRoot,
    staticMimeTypes: new Map([[".html", "text/html"]]),
  });
  const res = new CaptureResponse();

  serveStatic({ url: "/", headers: { host: "local.test" } }, res);
  await once(res, "finish");

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["content-type"], "text/html; charset=utf-8");
  assert.equal(res.body(), "<main>ok</main>");
});
