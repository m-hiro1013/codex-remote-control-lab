const fs = require("fs");
const path = require("path");

function createHttpSurface(options = {}) {
  const {
    publicRoot,
    staticMimeTypes = new Map(),
    tokenRequired = true,
  } = options;
  if (!publicRoot) throw new Error("publicRoot is required");
  const resolvedPublicRoot = path.resolve(publicRoot);

  function sendJson(res, status, body) {
    res.writeHead(status, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    });
    res.end(JSON.stringify(body));
  }

  function readJsonBody(req, limit = 1_000_000) {
    return new Promise((resolve, reject) => {
      let body = "";
      req.setEncoding("utf8");
      req.on("data", (chunk) => {
        body += chunk;
        if (body.length > limit) {
          reject(new Error("request body too large"));
          req.destroy();
        }
      });
      req.on("end", () => {
        if (!body) {
          resolve({});
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
      req.on("error", reject);
    });
  }

  function requireToken(url, phoneToken, res) {
    if (!tokenRequired) return true;
    if (url.searchParams.get("token") === phoneToken) return true;
    sendJson(res, 401, { error: "invalid token" });
    return false;
  }

  function serveStatic(req, res) {
    const requestPath = new URL(req.url, `http://${req.headers.host}`).pathname;
    const file = requestPath === "/" ? "index.html" : requestPath.slice(1);
    const target = path.join(resolvedPublicRoot, file);
    if (!target.startsWith(`${resolvedPublicRoot}${path.sep}`) && target !== resolvedPublicRoot) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    if (!fs.existsSync(target)) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const type = staticMimeTypes.get(path.extname(target).toLowerCase()) || "application/octet-stream";
    res.writeHead(200, { "content-type": `${type}; charset=utf-8`, "cache-control": "no-store" });
    fs.createReadStream(target).pipe(res);
  }

  return {
    readJsonBody,
    requireToken,
    sendJson,
    serveStatic,
  };
}

module.exports = {
  createHttpSurface,
};
