const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const WebSocket = require("ws");
const {
  appServerArgs,
} = require("./codex-app-server-config");
const {
  bridgeKeyForRequest,
  retentionConfigFromEnv,
  shouldDisposeIdleBridge,
  shouldScheduleIdleCleanup,
  shouldPromoteBridgeKey,
} = require("./bridge-state");
const { isHistorySyncEnabled, runHistorySync } = require("./history-sync");
const { bridgeUrls, notifyBridgeUrls } = require("./phone-notify");
const { isSessionBusy, normalizeHookState } = require("./session-state");
const { findLiveBridge, liveThreadSummaries, readThreadSnapshot } = require("./thread-read");
const { createApiRoutes } = require("./server/api-routes");
const { createBridgeRegistry } = require("./server/bridge-registry");
const { createBrowserSocketBinder } = require("./server/browser-socket");
const { createCodexAppServerRuntime } = require("./server/codex-app-server-runtime");
const { approvalResponseFor, prepareTurnStart } = require("./server/bridge-turn");
const { createHttpSurface } = require("./server/http-surface");
const { createPhoneHttpServer } = require("./server/phone-server");
const { sandboxPolicyForMode } = require("./server/sandbox-policy");
const { createSharedBridgeClass } = require("./server/shared-bridge");
const { createSessionService } = require("./server/session-service");
const { createStartupAnnouncement } = require("./server/startup-announcement");
const { createTerminalPtyRuntime } = require("./server/terminal-pty-runtime");
const {
  capHistory: capThreadHistory,
  historyFromThread: historyFromCodexThread,
  summarizeItem: summarizeThreadItem,
  summarizeLiveItem,
} = require("./server/thread-history");
const { parseWebSocketUpgradeRequest, writeUpgradeRejection } = require("./server/websocket-upgrade");
const { createWorkspaceAccess } = require("./server/workspace-access");

let pty = null;
try {
  pty = require("node-pty");
} catch {
  pty = null;
}

const root = path.resolve(__dirname, "..");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

// Walk up from root to find .env — handles git worktrees where root is
// several levels inside the actual project directory.
(function loadEnvWalkUp() {
  let dir = root;
  for (let i = 0; i < 6; i++) {
    loadEnvFile(path.join(dir, ".env"));
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
})();

const codexBin = path.join(root, "node_modules", ".bin", "codex");
const codexTerminalBin = process.env.CODEX_TERMINAL_BIN || (fs.existsSync(codexBin) ? codexBin : "codex");
const uiPort = Number(process.env.PHONE_UI_PORT || 45214);
const codexPort = Number(process.env.CODEX_APP_SERVER_PORT || 45213);
const codexSocketPath = process.env.CODEX_APP_SERVER_SOCK || "";
const codexUrl = process.env.CODEX_APP_SERVER_URL || (codexSocketPath ? "ws://codex-app-server/rpc" : `ws://127.0.0.1:${codexPort}`);
const shouldStartCodexServer = !process.env.CODEX_APP_SERVER_URL && !codexSocketPath;
const workdir = path.resolve(process.env.CODEX_WORKDIR || root);
const model = process.env.CODEX_MODEL || "gpt-5.4";
const historySyncEnabled = isHistorySyncEnabled(process.env);
const debugNoToken = /^(1|true|yes|on)$/i.test(process.env.PHONE_DEBUG_NO_TOKEN || "");
const debugBind = (process.env.PHONE_DEBUG_BIND || "").trim().toLowerCase();
const debugLan = debugNoToken && debugBind === "lan";
const authMode = debugNoToken ? "debug-no-token" : "token";
const tokenRequired = authMode === "token";
const configuredListenHost = (process.env.PHONE_UI_HOST || "").trim();
// Tailscale 専用で常駐させる時だけ、全 interface 公開を避けて bind 先を固定できるようにする。
const listenHost = configuredListenHost || (tokenRequired || debugLan ? "0.0.0.0" : "127.0.0.1");
const tokenPath = path.join(root, ".phone-token");
const uploadDir = path.join(root, ".uploads");
const bridges = new Map();
const threadAliases = new Map();
const terminalSessions = new Map();
const retainedSessionConfig = retentionConfigFromEnv(process.env);
const historyLimit = 80;
const imageExtensions = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".svg", "image/svg+xml"],
]);
const staticMimeTypes = new Map([
  [".css", "text/css"],
  [".html", "text/html"],
  [".js", "application/javascript"],
  [".json", "application/json"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webmanifest", "application/manifest+json"],
]);

const {
  decorateReviewFiles,
  discoverArtifacts,
  discoverWorkspaceEntries,
  isImagePath,
  mimeForPath,
  readAutomations,
  readDirectoryListing,
  readSkills,
  relativeDisplayPath,
  reviewSummary,
  runGit,
  safeDirectoryPath,
  safeOpenPath,
  safePathWithin,
  safeRelativePath,
  safeUploadPath,
  safeWorkdirPath,
  saveDataUrlAttachment,
} = createWorkspaceAccess({
  root,
  workdir,
  uploadDir,
  imageExtensions,
  env: process.env,
});

const {
  appServerRequest,
  createUpstreamWebSocket,
  startCodexServer,
  waitForReady,
} = createCodexAppServerRuntime({
  appServerArgs,
  codexBin,
  codexPort,
  codexSocketPath,
  codexUrl,
  env: process.env,
  hookEnvForToken: remoteHookEnv,
  root,
});

const {
  readJsonBody,
  requireToken,
  sendJson,
  serveStatic,
} = createHttpSurface({
  publicRoot: path.join(root, "public"),
  staticMimeTypes,
  tokenRequired,
});

const sessionService = createSessionService({
  bridges,
  defaultCwd: workdir,
  findLiveBridge: (threadId) => findLiveBridge(bridges, threadId),
  terminalSessions,
  threadAliases,
});

const { handleApiRequest } = createApiRoutes({
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
  sessionStateFor: sessionService.get,
  sessionStates: sessionService.list,
  shouldStartCodexServer,
  tokenRequired,
  uiPort,
  updateSessionState: sessionService.update,
  workdir,
});

const { bindTerminalSocket } = createTerminalPtyRuntime({
  codexSocketPath,
  codexTerminalBin,
  codexUrl,
  createIdleRetentionTimer,
  defaultWorkdir: workdir,
  env: process.env,
  findLiveBridge: (threadId) => findLiveBridge(bridges, threadId),
  pruneIdleRetainedSessions,
  pty,
  remoteHookEnv,
  retainedSessionConfig,
  sessionStateFor: sessionService.get,
  shouldDisposeIdleBridge,
  shouldScheduleIdleCleanup,
  terminalSessions,
  webSocketOpenState: WebSocket.OPEN,
});

function writeRemoteHookRuntime() {
  // debug/no-token bridge はテストや一時確認用なので、global hook の正本を書き換えない。
  if (!tokenRequired) return;
  const filePath = path.join(root, ".logs", "remote-control-hook-runtime.json");
  const data = {
    url: remoteHookUrl(),
    uiPort,
    updatedAt: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
}

function createIdleRetentionTimer(callback) {
  const timer = setTimeout(callback, retainedSessionConfig.idleTtlMs);
  timer.unref?.();
  return timer;
}

function pruneIdleRetainedSessions(collection, dispose) {
  if (collection.size <= retainedSessionConfig.maxSessions) return;
  const idleItems = Array.from(collection.values())
    .filter((item) => !item.clients?.size)
    .sort((a, b) => (a.lastAccessAt || a.updatedAt || a.createdAt || 0) - (b.lastAccessAt || b.updatedAt || b.createdAt || 0));
  while (collection.size > retainedSessionConfig.maxSessions && idleItems.length) {
    dispose(idleItems.shift());
  }
}

function getToken() {
  if (process.env.PHONE_TOKEN) return process.env.PHONE_TOKEN;
  if (fs.existsSync(tokenPath)) return fs.readFileSync(tokenPath, "utf8").trim();
  const token = crypto.randomBytes(18).toString("base64url");
  fs.writeFileSync(tokenPath, `${token}\n`, { mode: 0o600 });
  return token;
}

function lanAddresses() {
  const addresses = Object.values(os.networkInterfaces())
    .flat()
    .filter((entry) => entry && (entry.family === "IPv4" || entry.family === 4) && !entry.internal)
    .map((entry) => entry.address);

  try {
    const tailscaleIp = execFileSync("/usr/local/bin/tailscale", ["ip", "-4"], { encoding: "utf8", timeout: 1500 }).trim();
    if (tailscaleIp && !addresses.includes(tailscaleIp)) addresses.push(tailscaleIp);
  } catch {
    // Tailscale CLI が一時的に読めない場合でも LAN URL 表示は継続する。
  }

  return addresses;
}

function remoteHookUrl() {
  return `http://127.0.0.1:${uiPort}/api/codex-hook`;
}

function remoteHookEnv(phoneToken) {
  return {
    CODEX_REMOTE_CONTROL_LAB_ROOT: root,
    CODEX_REMOTE_HOOK_URL: remoteHookUrl(),
    CODEX_REMOTE_HOOK_TOKEN: phoneToken || "",
  };
}

function summarizeItem(item) {
  return summarizeThreadItem(item, { root, uploadDir, isImagePath });
}

function historyFromThread(thread) {
  return historyFromCodexThread(thread, { root, uploadDir, isImagePath, historyLimit });
}

function capHistory(history) {
  return capThreadHistory(history, historyLimit);
}

const SharedBridge = createSharedBridgeClass({
  approvalResponseFor,
  appServerRequest,
  bridges,
  capHistory,
  createIdleRetentionTimer,
  createUpstreamWebSocket,
  defaultWorkdir: workdir,
  historyFromThread,
  historySyncEnabled,
  isSessionBusy,
  model,
  prepareTurnStart,
  pruneIdleRetainedSessions,
  retainedSessionConfig,
  runHistorySync,
  sandboxPolicyForMode,
  saveDataUrlAttachment,
  sessionStateFor: sessionService.get,
  shouldDisposeIdleBridge,
  shouldPromoteBridgeKey,
  shouldScheduleIdleCleanup,
  summarizeItem,
  summarizeLiveItem,
  updateSessionState: sessionService.update,
  webSocketOpenState: WebSocket.OPEN,
});

const bridgeRegistry = createBridgeRegistry({
  bridgeKeyForRequest,
  bridges,
  createBridge: (threadId, bridgeKey, options) => new SharedBridge(threadId, bridgeKey, options),
  defaultWorkdir: workdir,
  findLiveBridge: (threadId) => findLiveBridge(bridges, threadId),
  pruneIdleRetainedSessions,
  threadAliases,
});

const { getBridge } = bridgeRegistry;

const bindBrowser = createBrowserSocketBinder({
  getBridge,
  randomUUID: crypto.randomUUID,
  tokenRequired,
});

const announceStartup = createStartupAnnouncement({
  bridgeUrls,
  codexSocketPath,
  codexUrl,
  debugLan,
  listenHost,
  model,
  notifyBridgeUrls,
  shouldStartCodexServer,
  tokenRequired,
  uiPort,
  workdir,
});

async function main() {
  const phoneToken = tokenRequired ? getToken() : "";
  process.env.CODEX_REMOTE_HOOK_URL = remoteHookUrl();
  process.env.CODEX_REMOTE_HOOK_TOKEN = phoneToken;
  writeRemoteHookRuntime();
  const codex = shouldStartCodexServer ? startCodexServer(phoneToken) : null;
  if (shouldStartCodexServer) {
    await waitForReady();
  } else {
    await appServerRequest("thread/loaded/list", { cursor: null, limit: 1 });
  }

  const { server } = createPhoneHttpServer({
    bindBrowser,
    bindTerminalSocket,
    createHttpServer: http.createServer,
    createWebSocketServer: () => new WebSocket.Server({ noServer: true }),
    defaultWorkdir: workdir,
    handleApiRequest,
    parseWebSocketUpgradeRequest,
    phoneToken,
    safeDirectoryPath,
    serveStatic,
    tokenRequired,
    writeUpgradeRejection,
  });

  server.listen(uiPort, listenHost, () => {
    const addresses = tokenRequired || debugLan ? lanAddresses() : ["127.0.0.1"];
    announceStartup({ addresses, phoneToken });
  });

  process.on("exit", () => {
    if (codex) codex.kill("SIGINT");
    for (const session of terminalSessions.values()) session.terminate();
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
} else {
  module.exports = {
    decorateReviewFiles,
    discoverWorkspaceEntries,
    relativeDisplayPath,
    readDirectoryListing,
    readSkills,
    reviewSummary,
    runGit,
    safeDirectoryPath,
    safeOpenPath,
    safePathWithin,
    safeRelativePath,
    safeWorkdirPath,
    normalizeHookState,
  };
}
