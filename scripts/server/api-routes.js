const fs = require("fs");
const os = require("os");

function createApiRoutes(deps = {}) {
  const {
    appServerRequest,
    authMode,
    bridges,
    codexPort,
    codexSocketPath,
    codexUrl,
    discoverArtifacts,
    discoverWorkspaceEntries,
    findLiveBridge,
    historyFromThread,
    historySyncEnabled,
    isImagePath,
    liveThreadSummaries,
    mimeForPath,
    model,
    normalizeHookState,
    readAutomations,
    readDirectoryListing,
    readJsonBody,
    readSkills,
    readThreadSnapshot,
    relativeDisplayPath,
    requireToken,
    reviewSummary,
    runHistorySync,
    safeDirectoryPath,
    safeOpenPath,
    safeUploadPath,
    sendJson,
    sessionStateFor,
    sessionStates,
    shouldStartCodexServer,
    tokenRequired,
    uiPort,
    updateSessionState,
    workdir,
  } = deps;

  async function handleApiRequest(req, res, url, phoneToken) {
    if (url.pathname === "/api/info") {
      sendJson(res, 200, {
        model,
        workdir,
        codexUrl,
        codexSocketPath: codexSocketPath || null,
        managedCodexServer: shouldStartCodexServer,
        tokenRequired,
        authMode,
      });
      return true;
    }
    if (url.pathname === "/api/codex-hook") {
      if (req.method !== "POST") {
        sendJson(res, 405, { error: "method not allowed" });
        return true;
      }
      if (tokenRequired && req.headers["x-codex-remote-hook-token"] !== phoneToken) {
        sendJson(res, 401, { error: "invalid hook token" });
        return true;
      }
      try {
        const payload = await readJsonBody(req);
        const state = updateSessionState(normalizeHookState(payload));
        sendJson(res, 200, { ok: true, state });
      } catch (error) {
        sendJson(res, 400, { error: error.message });
      }
      return true;
    }
    if (url.pathname === "/api/threads") {
      if (!requireToken(url, phoneToken, res)) return true;
      try {
        const result = await appServerRequest("thread/list", {
          limit: 30,
          sortKey: "updated_at",
          sortDirection: "desc",
          archived: false,
          useStateDbOnly: false,
        });
        sendJson(res, 200, result);
      } catch (error) {
        sendJson(res, 500, { error: error.message });
      }
      return true;
    }
    if (url.pathname === "/api/live-threads") {
      if (!requireToken(url, phoneToken, res)) return true;
      sendJson(res, 200, {
        data: liveThreadSummaries(bridges, { sessionStateFor }),
      });
      return true;
    }
    if (url.pathname === "/api/models") {
      if (!requireToken(url, phoneToken, res)) return true;
      try {
        const result = await appServerRequest("model/list", { limit: 80, includeHidden: false });
        sendJson(res, 200, result);
      } catch (error) {
        sendJson(res, 500, { error: error.message });
      }
      return true;
    }
    if (url.pathname === "/api/plugins") {
      if (!requireToken(url, phoneToken, res)) return true;
      try {
        const result = await appServerRequest("plugin/list", { cwds: [workdir] });
        sendJson(res, 200, result);
      } catch (error) {
        sendJson(res, 500, { error: error.message });
      }
      return true;
    }
    if (url.pathname === "/api/config") {
      if (!requireToken(url, phoneToken, res)) return true;
      try {
        const [config, auth] = await Promise.allSettled([
          appServerRequest("config/read", { includeLayers: false, cwd: workdir }),
          appServerRequest("getAuthStatus", {}),
        ]);
        sendJson(res, 200, {
          config: config.status === "fulfilled" ? config.value : null,
          auth: auth.status === "fulfilled" ? auth.value : null,
          errors: [config, auth]
            .filter((result) => result.status === "rejected")
            .map((result) => result.reason.message),
        });
      } catch (error) {
        sendJson(res, 500, { error: error.message });
      }
      return true;
    }
    if (url.pathname === "/api/status") {
      if (!requireToken(url, phoneToken, res)) return true;
      sendJson(res, 200, {
        workdir,
        model,
        codexUrl,
        codexSocketPath: codexSocketPath || null,
        managedCodexServer: shouldStartCodexServer,
        historySyncEnabled,
        tokenRequired,
        authMode,
        uiPort,
        codexPort,
        bridges: Array.from(bridges.values()).map((bridge) => ({
          threadId: bridge.threadId,
          workdir: bridge.cwd,
          clients: bridge.clients.size,
          ready: bridge.ready,
          materialized: bridge.materialized,
          sessionState: sessionStateFor(bridge.threadId, bridge.cwd),
        })),
        sessionStates: Array.from(sessionStates.values()),
      });
      return true;
    }
    if (url.pathname === "/api/history-sync") {
      if (!requireToken(url, phoneToken, res)) return true;
      const threadId = url.searchParams.get("thread");
      if (!threadId) {
        sendJson(res, 400, { error: "thread is required" });
        return true;
      }
      try {
        const result = await runHistorySync({
          threadId,
          workdir,
          request: appServerRequest,
          enabled: historySyncEnabled,
        });
        sendJson(res, 200, result);
      } catch (error) {
        sendJson(res, 500, { error: error.message });
      }
      return true;
    }
    if (url.pathname === "/api/thread") {
      if (!requireToken(url, phoneToken, res)) return true;
      const threadId = url.searchParams.get("thread");
      if (!threadId) {
        sendJson(res, 400, { error: "thread is required" });
        return true;
      }
      try {
        const snapshot = await readThreadSnapshot({
          threadId,
          liveBridge: findLiveBridge(bridges, threadId),
          request: appServerRequest,
          model,
          workdir,
          historyFromThread,
          refreshLiveBridge: true,
        });
        sendJson(res, 200, snapshot);
      } catch (error) {
        sendJson(res, 500, { error: error.message });
      }
      return true;
    }
    if (url.pathname === "/api/automations") {
      if (!requireToken(url, phoneToken, res)) return true;
      sendJson(res, 200, { data: readAutomations() });
      return true;
    }
    if (url.pathname === "/api/skills") {
      if (!requireToken(url, phoneToken, res)) return true;
      sendJson(res, 200, { data: readSkills() });
      return true;
    }
    if (url.pathname === "/api/fs/root") {
      if (!requireToken(url, phoneToken, res)) return true;
      const home = safeDirectoryPath(os.homedir(), os.homedir());
      sendJson(res, 200, { root: home?.absolute || os.homedir() });
      return true;
    }
    if (url.pathname === "/api/fs/list") {
      if (!requireToken(url, phoneToken, res)) return true;
      const listing = readDirectoryListing(url.searchParams.get("path"), url.searchParams.get("hidden") === "1", os.homedir());
      if (!listing) {
        sendJson(res, 404, { error: "directory not found or outside home" });
        return true;
      }
      sendJson(res, 200, listing);
      return true;
    }
    if (url.pathname === "/api/artifacts") {
      if (!requireToken(url, phoneToken, res)) return true;
      sendJson(res, 200, { data: discoverArtifacts() });
      return true;
    }
    if (url.pathname === "/api/workspace") {
      if (!requireToken(url, phoneToken, res)) return true;
      try {
        sendJson(res, 200, {
          data: await discoverWorkspaceEntries({
            limit: Number(url.searchParams.get("limit") || 200),
            query: url.searchParams.get("q") || "",
          }),
        });
      } catch (error) {
        sendJson(res, 500, { error: error.message });
      }
      return true;
    }
    if (url.pathname === "/api/review") {
      if (!requireToken(url, phoneToken, res)) return true;
      try {
        sendJson(res, 200, await reviewSummary());
      } catch (error) {
        sendJson(res, 500, { error: error.message });
      }
      return true;
    }
    if (url.pathname === "/api/uploaded") {
      if (!requireToken(url, phoneToken, res)) return true;
      const target = safeUploadPath(url.searchParams.get("name"));
      if (!target || !fs.existsSync(target) || !fs.statSync(target).isFile() || !isImagePath(target)) {
        sendJson(res, 404, { error: "image not found" });
        return true;
      }
      res.writeHead(200, { "content-type": mimeForPath(target), "cache-control": "no-store" });
      fs.createReadStream(target).pipe(res);
      return true;
    }
    if (url.pathname === "/api/file/raw") {
      if (!requireToken(url, phoneToken, res)) return true;
      const target = safeOpenPath(url.searchParams.get("path"));
      if (!target || !fs.existsSync(target) || !fs.statSync(target).isFile() || !isImagePath(target)) {
        sendJson(res, 404, { error: "image not found" });
        return true;
      }
      res.writeHead(200, { "content-type": mimeForPath(target), "cache-control": "no-store" });
      fs.createReadStream(target).pipe(res);
      return true;
    }
    if (url.pathname === "/api/file") {
      if (!requireToken(url, phoneToken, res)) return true;
      const target = safeOpenPath(url.searchParams.get("path"));
      if (!target || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
        sendJson(res, 404, { error: "file not found" });
        return true;
      }
      if (isImagePath(target)) {
        sendJson(res, 200, {
          path: relativeDisplayPath(target),
          kind: "image",
          mimeType: mimeForPath(target),
          imageUrl: `/api/file/raw?path=${encodeURIComponent(relativeDisplayPath(target))}`,
        });
        return true;
      }
      sendJson(res, 200, {
        path: relativeDisplayPath(target),
        kind: /\.md(?:own)?$/i.test(target) ? "markdown" : "text",
        text: fs.readFileSync(target, "utf8").slice(0, 80_000),
      });
      return true;
    }
    return false;
  }

  return { handleApiRequest };
}

module.exports = {
  createApiRoutes,
};
