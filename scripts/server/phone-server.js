function createPhoneHttpServer({
  bindBrowser,
  bindTerminalSocket,
  createHttpServer,
  createWebSocketServer,
  defaultWorkdir,
  handleApiRequest,
  parseWebSocketUpgradeRequest,
  phoneToken,
  safeDirectoryPath,
  serveStatic,
  tokenRequired,
  writeUpgradeRejection,
}) {
  const server = createHttpServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (await handleApiRequest(req, res, url, phoneToken)) return;
    serveStatic(req, res);
  });

  const wss = createWebSocketServer();
  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const upgrade = parseWebSocketUpgradeRequest({
      defaultWorkdir,
      phoneToken,
      safeDirectoryPath,
      tokenRequired,
      url,
    });
    if (!upgrade.ok) {
      writeUpgradeRejection(socket, upgrade);
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      if (upgrade.kind === "terminal") {
        bindTerminalSocket(ws, {
          threadId: upgrade.threadId,
          cwd: upgrade.cwd,
          cols: upgrade.cols,
          rows: upgrade.rows,
        });
        return;
      }
      bindBrowser(ws, phoneToken, upgrade.threadId, { forceNew: upgrade.forceNew, cwd: upgrade.cwd });
    });
  });

  return { server, wss };
}

module.exports = {
  createPhoneHttpServer,
};
