const os = require("os");

function parseWebSocketUpgradeRequest(options = {}) {
  const {
    defaultWorkdir,
    homeDir = os.homedir(),
    phoneToken = "",
    safeDirectoryPath,
    tokenRequired = true,
    url,
  } = options;
  if (!url) throw new Error("url is required");
  if (typeof safeDirectoryPath !== "function") throw new Error("safeDirectoryPath is required");

  if (url.pathname !== "/bridge" && url.pathname !== "/terminal") {
    return { ok: false, action: "destroy" };
  }
  if (tokenRequired && url.searchParams.get("token") !== phoneToken) {
    return { ok: false, action: "http", status: 401, message: "Unauthorized" };
  }

  const threadId = url.searchParams.get("thread") || null;
  const requestedCwd = url.searchParams.get("cwd");
  const safeCwd = requestedCwd ? safeDirectoryPath(requestedCwd, homeDir) : null;
  if (requestedCwd && !safeCwd) {
    return { ok: false, action: "http", status: 400, message: "Bad Request" };
  }
  if (url.pathname === "/terminal" && !threadId) {
    return { ok: false, action: "http", status: 400, message: "Bad Request" };
  }

  return {
    ok: true,
    cwd: safeCwd?.absolute || defaultWorkdir,
    forceNew: url.searchParams.get("new") === "1",
    kind: url.pathname === "/terminal" ? "terminal" : "bridge",
    rows: Number(url.searchParams.get("rows") || 30),
    cols: Number(url.searchParams.get("cols") || 100),
    threadId,
  };
}

function writeUpgradeRejection(socket, result) {
  if (result.action === "destroy") {
    socket.destroy();
    return;
  }
  socket.write(`HTTP/1.1 ${result.status} ${result.message}\r\n\r\n`);
  socket.destroy();
}

module.exports = {
  parseWebSocketUpgradeRequest,
  writeUpgradeRejection,
};
