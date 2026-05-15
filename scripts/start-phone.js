const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
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
const { isSessionBusy, mergeSessionState, normalizeHookState } = require("./session-state");
const { findLiveBridge, liveThreadSummaries, readThreadSnapshot } = require("./thread-read");
const { createApiRoutes } = require("./server/api-routes");
const { createCodexAppServerRuntime } = require("./server/codex-app-server-runtime");
const { createHttpSurface } = require("./server/http-surface");
const { sandboxPolicyForMode } = require("./server/sandbox-policy");
const {
  broadcastSessionStateToTargets,
  drainReadyBridgeQueues,
  migrateBridgeThreadOwnership,
  sessionStateFor: findSessionStateFor,
  sessionStateKey,
} = require("./server/session-ownership");
const { createTerminalPtyRuntime } = require("./server/terminal-pty-runtime");
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
const listenHost = tokenRequired || debugLan ? "0.0.0.0" : "127.0.0.1";
const tokenPath = path.join(root, ".phone-token");
const uploadDir = path.join(root, ".uploads");
const bridges = new Map();
const threadAliases = new Map();
const terminalSessions = new Map();
const sessionStates = new Map();
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
  sessionStateFor,
  sessionStates,
  shouldStartCodexServer,
  tokenRequired,
  uiPort,
  updateSessionState,
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
  sessionStateFor,
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
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((entry) => entry && (entry.family === "IPv4" || entry.family === 4) && !entry.internal)
    .map((entry) => entry.address);
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

function sessionStateFor(threadId, cwd = "") {
  return findSessionStateFor({ sessionStates, threadId, cwd, defaultCwd: workdir });
}

function migrateCurrentBridgeThreadOwnership(state) {
  return migrateBridgeThreadOwnership({
    state,
    bridges,
    threadAliases,
    findLiveBridge,
    defaultCwd: workdir,
  });
}

function updateSessionState(statePatch) {
  const key = sessionStateKey({ sessionId: statePatch.sessionId, cwd: statePatch.cwd, defaultCwd: workdir });
  const previous = sessionStates.get(key);
  const state = mergeSessionState(previous, statePatch);
  sessionStates.set(key, state);
  if (state.cwd) sessionStates.set(sessionStateKey({ cwd: state.cwd, defaultCwd: workdir }), state);
  migrateCurrentBridgeThreadOwnership(state);
  broadcastSessionStateToTargets({ state, bridges, terminalSessions });
  if (!isSessionBusy(state)) {
    drainReadyBridgeQueues({ state, bridges });
  }
  return state;
}

function stripUiDirectives(text) {
  return String(text || "")
    .replace(/(?:^|\n)::[a-z0-9-]+\{[^\n]*\}(?=\n|$)/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function summarizeItem(item) {
  if (item.type === "userMessage") {
    const textParts = [];
    const attachments = [];
    for (const part of item.content) {
      if (part.type === "text") {
        textParts.push(part.text);
        continue;
      }
      if (part.type === "localImage" && part.path) {
        const absolutePath = path.resolve(part.path);
        if (absolutePath.startsWith(`${uploadDir}${path.sep}`)) {
          attachments.push({
            name: path.basename(absolutePath),
            url: `/api/uploaded?name=${encodeURIComponent(path.basename(absolutePath))}`,
          });
        } else if (absolutePath.startsWith(`${root}${path.sep}`) && isImagePath(absolutePath)) {
          const relative = path.relative(root, absolutePath);
          attachments.push({ name: path.basename(absolutePath), url: `/api/file/raw?path=${encodeURIComponent(relative)}` });
        }
      }
    }
    return {
      type: "user",
      text: textParts.join("\n") || (attachments.length ? "添付画像" : ""),
      attachments,
    };
  }
  if (item.type === "agentMessage") return { type: "assistant", text: stripUiDirectives(item.text) };
  if (item.type === "commandExecution") return { type: "status", text: `$ ${item.command}` };
  if (item.type === "fileChange") return { type: "status", text: `file changes: ${item.status}` };
  return null;
}

function summarizeLiveItem(item, phase = "completed") {
  if (!item) return null;
  if (item.type === "commandExecution") {
    return phase === "started" ? `$ ${item.command}` : null;
  }
  if (item.type === "fileChange") {
    return `file changes: ${item.status}`;
  }
  return null;
}

function historyFromThread(thread) {
  const history = [];
  for (const turn of thread.turns || []) {
    for (const item of turn.items || []) {
      const entry = summarizeItem(item);
      if (entry && entry.text) history.push(entry);
    }
  }
  return capHistory(history);
}

function capHistory(history) {
  return history.slice(-historyLimit);
}

class SharedBridge {
  constructor(requestedThreadId, bridgeKey, options = {}) {
    this.requestedThreadId = requestedThreadId;
    this.bridgeKey = bridgeKey;
    this.cwd = options.cwd || workdir;
    this.clients = new Set();
    this.nextId = 1;
    this.pending = new Map();
    this.threadId = null;
    this.activeTurnId = null;
    this.ready = false;
    this.startupFailed = false;
    this.materialized = Boolean(this.requestedThreadId);
    this.createdAt = Date.now();
    this.updatedAt = this.createdAt;
    this.lastAccessAt = this.createdAt;
    this.idleDeadlineAt = 0;
    this.cleanupTimer = null;
    this.history = [];
    this.turnQueue = [];
    this.upstream = createUpstreamWebSocket();
    this.bindUpstream();
  }

  addClient(browser) {
    this.cancelIdleCleanup();
    this.touchAccess();
    this.clients.add(browser);
    this.emitTo(browser, "status", { text: "共有Codexブリッジに参加しました。" });
    if (this.ready) {
      this.emitTo(browser, "ready", this.readyPayload());
    }
    browser.on("close", () => {
      this.clients.delete(browser);
      if (shouldScheduleIdleCleanup({ clientCount: this.clients.size })) {
        this.scheduleIdleCleanup();
        pruneIdleRetainedSessions(bridges, (bridge) => bridge.dispose());
      }
    });
  }

  touchAccess() {
    const now = Date.now();
    this.lastAccessAt = now;
    this.updatedAt = now;
  }

  cancelIdleCleanup() {
    clearTimeout(this.cleanupTimer);
    this.cleanupTimer = null;
    this.idleDeadlineAt = 0;
  }

  scheduleIdleCleanup() {
    this.cancelIdleCleanup();
    this.idleDeadlineAt = Date.now() + retainedSessionConfig.idleTtlMs;
    this.cleanupTimer = createIdleRetentionTimer(() => this.disposeIfIdle());
  }

  noteActivity() {
    this.touchAccess();
    if (!this.clients.size) this.scheduleIdleCleanup();
  }

  disposeIfIdle() {
    if (!shouldDisposeIdleBridge({ clientCount: this.clients.size, idleDeadlineAt: this.idleDeadlineAt })) return;
    this.dispose();
  }

  dispose() {
    this.cancelIdleCleanup();
    try {
      this.upstream.close();
    } catch {}
    bridges.delete(this.bridgeKey);
  }

  readyPayload() {
    return {
      threadId: this.threadId,
      model,
      workdir: this.cwd,
      shared: true,
      clients: this.clients.size,
      history: this.history,
      materialized: this.materialized,
      sessionState: sessionStateFor(this.threadId, this.cwd),
    };
  }

  emit(type, payload = {}) {
    const body = JSON.stringify({ type, ...payload });
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(body);
    }
  }

  emitTo(client, type, payload = {}) {
    if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify({ type, ...payload }));
  }

  request(method, params) {
    this.touchAccess();
    const id = this.nextId++;
    this.upstream.send(JSON.stringify({ id, method, params }));
    return id;
  }

  hasPendingTurnStart() {
    return Array.from(this.pending.values()).includes("turn/start");
  }

  promoteBridgeKey() {
    if (!shouldPromoteBridgeKey({ bridgeKey: this.bridgeKey, threadId: this.threadId })) return;
    this.rehomeBridgeKey(this.threadId);
  }

  rehomeBridgeKey(nextKey) {
    if (!nextKey || this.bridgeKey === nextKey) return;
    const previousKey = this.bridgeKey;
    if (bridges.has(nextKey) && bridges.get(nextKey) !== this) return;
    if (bridges.get(previousKey) !== this) return;
    this.bridgeKey = nextKey;
    bridges.delete(previousKey);
    bridges.set(this.bridgeKey, this);
  }

  bindUpstream() {
    this.upstream.on("open", () => {
      this.request("initialize", {
        clientInfo: { name: "codex-phone-bridge", title: "Codex Phone Bridge", version: "0.1.0" },
      });
      this.upstream.send(JSON.stringify({ method: "initialized", params: {} }));
      const method = this.requestedThreadId ? "thread/resume" : "thread/start";
      const params = this.requestedThreadId
        ? {
            threadId: this.requestedThreadId,
            model,
            cwd: this.cwd,
            approvalPolicy: "on-request",
            sandbox: "workspace-write",
          }
        : {
            model,
            cwd: this.cwd,
            approvalPolicy: "on-request",
            sandbox: "workspace-write",
          };
      const id = this.request(method, params);
      this.pending.set(id, method);
      this.emit("status", { text: this.requestedThreadId ? "既存threadを再開中..." : "新しいthreadを開始中..." });
    });

    this.upstream.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      this.noteActivity();
      const pendingMethod = this.pending.get(msg.id);

      if (pendingMethod === "thread/start" || pendingMethod === "thread/resume") {
        this.pending.delete(msg.id);
        if (msg.error) {
          this.startupFailed = true;
          this.emit("error", { text: msg.error.message || JSON.stringify(msg.error) });
          return;
        }
        this.threadId = msg.result.thread.id;
        this.startupFailed = false;
        this.promoteBridgeKey();
        this.ready = true;
        this.touchAccess();
        this.history = historyFromThread(msg.result.thread);
        this.materialized = this.materialized || this.history.length > 0;
        this.emit("ready", this.readyPayload());
        if (this.requestedThreadId) this.emit("status", { text: `既存threadを再開しました: ${this.threadId}` });
        return;
      }

      if (pendingMethod === "turn/start") {
        this.pending.delete(msg.id);
        if (msg.error) {
          this.emit("error", { text: msg.error.message || JSON.stringify(msg.error) });
          this.startNextQueuedTurn();
        } else {
          this.activeTurnId = msg.result.turn.id;
          this.updatedAt = Date.now();
          updateSessionState({
            source: "app-server",
            status: "running",
            label: "Codex 処理中",
            busy: true,
            completed: false,
            sessionId: this.threadId,
            turnId: this.activeTurnId,
            cwd: this.cwd,
            event: "turn/start",
            updatedAt: Date.now(),
          });
          this.emit("turn", { status: "started", turnId: this.activeTurnId });
        }
        return;
      }

      if (msg.method === "item/agentMessage/delta") {
        this.emit("assistantDelta", { text: msg.params.delta });
        return;
      }

      if (msg.method === "item/started") {
        const text = summarizeLiveItem(msg.params.item, "started");
        if (text) this.emit("status", { text });
        return;
      }

      if (msg.method === "item/completed") {
        const entry = summarizeItem(msg.params.item);
        if (entry && entry.type !== "user") this.appendHistory(entry);
        const text = summarizeLiveItem(msg.params.item, "completed");
        if (text) this.emit("status", { text });
        this.emit("event", { event: msg });
        return;
      }

      if (msg.method === "turn/completed") {
        this.activeTurnId = null;
        this.updatedAt = Date.now();
        this.materialized = true;
        updateSessionState({
          source: "app-server",
          status: "input_ready",
          label: "入力待ち",
          busy: false,
          completed: true,
          sessionId: this.threadId,
          turnId: msg.params.turnId,
          cwd: this.cwd,
          event: "turn/completed",
          updatedAt: Date.now(),
        });
        this.emit("turn", { status: "completed", turnId: msg.params.turnId });
        this.syncHistory("turn completed");
        this.startNextQueuedTurn();
        return;
      }

      if (msg.method && msg.method.endsWith("/requestApproval")) {
        updateSessionState({
          source: "app-server",
          status: "awaiting_approval",
          label: "承認待ち",
          busy: true,
          completed: false,
          sessionId: this.threadId,
          turnId: this.activeTurnId,
          cwd: this.cwd,
          event: msg.method,
          updatedAt: Date.now(),
        });
        this.emit("approval", { request: msg });
        return;
      }

      if (msg.method === "error") {
        this.emit("error", { text: msg.params.message || JSON.stringify(msg.params) });
        return;
      }

      this.emit("event", { event: msg });
    });

    this.upstream.on("error", (error) => {
      if (!this.ready) this.startupFailed = true;
      this.emit("error", { text: error.message });
    });
    this.upstream.on("close", () => {
      if (!this.ready) this.startupFailed = true;
      this.emit("status", { text: "Codex接続が閉じました" });
    });
  }

  prompt(text, attachments = [], options = {}) {
    this.touchAccess();
    if (!this.threadId) {
      this.emit("error", { text: "Thread is not ready yet" });
      return;
    }
    if (this.activeTurnId || this.hasPendingTurnStart() || isSessionBusy(sessionStateFor(this.threadId, this.cwd))) {
      this.turnQueue.push({ text, attachments, options });
      this.emit("status", { text: `キューに追加しました（${this.turnQueue.length}件待機）` });
      return;
    }
    this.startPrompt(text, attachments, options);
  }

  startNextQueuedTurn() {
    if (
      !this.ready ||
      this.activeTurnId ||
      this.hasPendingTurnStart() ||
      isSessionBusy(sessionStateFor(this.threadId, this.cwd)) ||
      !this.turnQueue.length
    ) {
      return;
    }
    const next = this.turnQueue.shift();
    this.emit("status", { text: `キューから送信中（残り${this.turnQueue.length}件）` });
    this.startPrompt(next.text, next.attachments, next.options);
  }

  syncHistory(reason) {
    if (!this.threadId || !historySyncEnabled) return;
    runHistorySync({
      threadId: this.threadId,
      workdir: this.cwd,
      request: appServerRequest,
      enabled: historySyncEnabled,
    })
      .then((result) => {
        if (!result.skipped) this.emit("status", { text: `履歴同期を更新しました (${reason})` });
      })
      .catch((error) => {
        this.emit("status", { text: `履歴同期に失敗しました: ${error.message}` });
      });
  }

  startPrompt(text, attachments = [], options = {}) {
    const input = [{ type: "text", text, text_elements: [] }];
    const savedImages = [];
    for (const attachment of attachments || []) {
      const saved = saveDataUrlAttachment(attachment);
      if (saved) {
        input.push(saved.input);
        savedImages.push(saved.preview);
      }
    }
    const params = {
      threadId: this.threadId,
      input,
    };
    if (options.model) params.model = options.model;
    if (options.approvalPolicy) params.approvalPolicy = options.approvalPolicy;
    if (options.sandboxMode) params.sandboxPolicy = sandboxPolicyForMode(options.sandboxMode, this.cwd);
    const id = this.request("turn/start", {
      ...params,
    });
    this.pending.set(id, "turn/start");
    const displayText = savedImages.length ? `${text}\n\n添付: ${savedImages.map((image) => image.name).join(", ")}` : text;
    this.appendHistory({ type: "user", text: displayText, attachments: savedImages });
    this.emit("user", { text: displayText, attachments: savedImages });
  }

  appendHistory(entry) {
    this.history.push(entry);
    this.touchAccess();
    this.history = capHistory(this.history);
  }

  approval(requestMsg, decision) {
    this.touchAccess();
    if (!requestMsg || !requestMsg.id || !requestMsg.method) return;
    const accept = decision === "accept";
    let result;
    if (requestMsg.method === "item/commandExecution/requestApproval") {
      result = { decision: accept ? "accept" : "decline" };
    } else if (requestMsg.method === "item/fileChange/requestApproval") {
      result = { decision: accept ? "accept" : "decline" };
    } else {
      result = accept ? { decision: "accept" } : { decision: "decline" };
    }
    this.upstream.send(JSON.stringify({ id: requestMsg.id, result }));
    this.emit("status", { text: accept ? "承認しました" : "拒否しました" });
  }
}

function getBridge(threadId, connectionId = crypto.randomUUID(), options = {}) {
  const canonicalThreadId = resolveThreadAlias(threadId);
  if (!threadId && !options.forceNew) {
    for (const bridge of bridges.values()) {
      if (!bridge.requestedThreadId) return bridge;
    }
  }
  const existing = findLiveBridge(bridges, canonicalThreadId);
  if (existing) return existing;
  const key = options.forceNew && !canonicalThreadId ? `new:${connectionId}` : bridgeKeyForRequest(canonicalThreadId, connectionId);
  if (!bridges.has(key)) bridges.set(key, new SharedBridge(canonicalThreadId, key, { cwd: options.cwd || workdir }));
  pruneIdleRetainedSessions(bridges, (bridge) => bridge.dispose());
  return bridges.get(key);
}

function bindBrowser(browser, phoneToken, threadId, options = {}) {
  const bridge = getBridge(threadId, crypto.randomUUID(), options);
  bridge.addClient(browser);

  browser.on("message", (data) => {
    const msg = JSON.parse(data.toString());
    if (tokenRequired && msg.token !== phoneToken) {
      bridge.emitTo(browser, "error", { text: "Invalid token" });
      browser.close();
      return;
    }
    if (msg.type === "prompt") bridge.prompt(msg.text, msg.attachments, msg.options);
    if (msg.type === "approval") bridge.approval(msg.request, msg.decision);
  });
}

function resolveThreadAlias(threadId) {
  let current = threadId;
  const visited = new Set();
  while (current && threadAliases.has(current) && !visited.has(current)) {
    visited.add(current);
    current = threadAliases.get(current);
  }
  if (!current || current === threadId) return threadId;
  if (findLiveBridge(bridges, current)) return current;
  threadAliases.delete(threadId);
  return threadId;
}

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

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (await handleApiRequest(req, res, url, phoneToken)) return;
    serveStatic(req, res);
  });

  const wss = new WebSocket.Server({ noServer: true });
  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const upgrade = parseWebSocketUpgradeRequest({
      defaultWorkdir: workdir,
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

  server.listen(uiPort, listenHost, () => {
    const addresses = tokenRequired || debugLan ? lanAddresses() : ["127.0.0.1"];
    const urls = bridgeUrls(addresses, uiPort, phoneToken);
    console.log("");
    console.log("Codex shared browser bridge is ready.");
    for (const url of urls) console.log(`  ${url}`);
    console.log("");
    console.log(`Auth:    ${tokenRequired ? "token" : debugLan ? "debug-no-token (LAN exposed)" : "debug-no-token (localhost only)"}`);
    console.log(`Listen:  ${listenHost}:${uiPort}`);
    console.log(`Workdir: ${workdir}`);
    console.log(`Model:   ${model}`);
    console.log(`Codex:   ${shouldStartCodexServer ? codexUrl : codexSocketPath || codexUrl}`);
    if (tokenRequired) console.log("Open the same URL from PC and phone to share one bridge thread.");
    else if (debugLan) console.log("Tokenless debug LAN mode is exposed to this network. Use only on a trusted LAN.");
    else console.log("Open the URL on this Mac only; tokenless debug mode is not exposed to the LAN.");
    console.log("Press Ctrl+C to stop.");

    if (!tokenRequired) {
      console.log("[notify] skipped in debug-no-token mode");
      return;
    }

    notifyBridgeUrls(urls).then((results) => {
      for (const result of results) {
        if (result.ok) console.log(`[notify] sent via ${result.type}`);
        else console.warn(`[notify] ${result.type} failed: ${result.error}`);
      }
    });
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
