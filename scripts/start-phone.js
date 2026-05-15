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
const { createCodexAppServerRuntime } = require("./server/codex-app-server-runtime");
const { createHttpSurface } = require("./server/http-surface");
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

function stateKeyForSession(sessionId, cwd = "") {
  if (sessionId) return `session:${sessionId}`;
  return `cwd:${path.resolve(cwd || workdir)}`;
}

function sessionStateFor(threadId, cwd = "") {
  const direct = sessionStates.get(stateKeyForSession(threadId, cwd));
  if (direct) return direct;
  if (!cwd) return null;
  return sessionStates.get(stateKeyForSession("", cwd)) || null;
}

function sessionStateMatches(state, threadId, cwd = "") {
  if (!state) return false;
  if (threadId && state.sessionId && state.sessionId === threadId) return true;
  if (cwd && state.cwd && path.resolve(state.cwd) === path.resolve(cwd)) return true;
  return false;
}

function broadcastSessionState(state) {
  for (const bridge of bridges.values()) {
    if (!sessionStateMatches(state, bridge.threadId || bridge.requestedThreadId, bridge.cwd)) continue;
    bridge.noteActivity?.();
    bridge.emit("sessionState", { state });
  }
  for (const session of terminalSessions.values()) {
    if (!sessionStateMatches(state, session.threadId, session.cwd)) continue;
    session.noteActivity?.();
    session.broadcast({ type: "sessionState", state });
  }
}

function migrateBridgeThreadOwnership(state) {
  if (!state?.sessionId || !state?.cwd) return;
  const directBridge = findLiveBridge(bridges, state.sessionId);
  if (directBridge) {
    const nextCwd = path.resolve(state.cwd);
    if (path.resolve(directBridge.cwd || workdir) !== nextCwd) {
      directBridge.cwd = nextCwd;
      directBridge.updatedAt = Date.now();
    }
    return;
  }
  const sameCwdBridges = Array.from(bridges.values()).filter((bridge) => {
    if (!bridge?.cwd) return false;
    return path.resolve(bridge.cwd) === path.resolve(state.cwd);
  });
  if (sameCwdBridges.length !== 1) return;
  const [bridge] = sameCwdBridges;
  if (!bridge) return;
  if (bridge.threadId === state.sessionId) {
    bridge.rehomeBridgeKey?.(state.sessionId);
    return;
  }
  const previousThreadId = bridge.threadId;
  bridge.threadId = state.sessionId;
  bridge.rehomeBridgeKey?.(state.sessionId);
  if (previousThreadId) threadAliases.set(previousThreadId, state.sessionId);
}

function updateSessionState(statePatch) {
  const key = stateKeyForSession(statePatch.sessionId, statePatch.cwd);
  const previous = sessionStates.get(key);
  const state = mergeSessionState(previous, statePatch);
  sessionStates.set(key, state);
  if (state.cwd) sessionStates.set(stateKeyForSession("", state.cwd), state);
  migrateBridgeThreadOwnership(state);
  broadcastSessionState(state);
  if (!isSessionBusy(state)) {
    for (const bridge of bridges.values()) {
      if (sessionStateMatches(state, bridge.threadId || bridge.requestedThreadId, bridge.cwd)) bridge.startNextQueuedTurn?.();
    }
  }
  return state;
}

function sandboxPolicyForMode(mode, cwd = workdir) {
  if (mode === "danger-full-access") return { type: "dangerFullAccess" };
  if (mode === "read-only") return { type: "readOnly", networkAccess: true };
  return {
    type: "workspaceWrite",
    writableRoots: [cwd],
    networkAccess: true,
    excludeTmpdirEnvVar: false,
    excludeSlashTmp: false,
  };
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

function terminalKeyFor(threadId, cwd) {
  return `${threadId || "new"}:${path.resolve(cwd || workdir)}`;
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

function terminalCodexArgs(threadId, cwd) {
  const args = ["resume"];
  if (!codexSocketPath && codexUrl) args.push("--remote", codexUrl);
  args.push("-C", cwd);
  args.push(threadId);
  return args;
}

function isTerminalInterruptInput(data) {
  const text = String(data || "");
  return text === "\u001b" || text.includes("\u0003");
}

class TerminalPtySession {
  constructor({ threadId, cwd, cols, rows }) {
    this.threadId = threadId;
    this.cwd = cwd || workdir;
    this.clients = new Set();
    this.buffer = "";
    this.closed = false;
    this.cleanupTimer = null;
    this.createdAt = Date.now();
    this.updatedAt = this.createdAt;
    this.lastAccessAt = this.createdAt;
    this.idleDeadlineAt = 0;
    this.proc = this.spawn(cols, rows);
  }

  spawn(cols = 100, rows = 30) {
    if (!pty) throw new Error("node-pty is not available. Run npm install before using terminal mode.");
    if (!this.threadId) throw new Error("thread is required for Codex terminal resume");
    const executable = codexTerminalBin;
    const args = terminalCodexArgs(this.threadId, this.cwd);
    const proc = pty.spawn(executable, args, {
      cwd: this.cwd,
      cols: Math.max(20, Number(cols) || 100),
      rows: Math.max(8, Number(rows) || 30),
      env: {
        ...process.env,
        ...remoteHookEnv(process.env.CODEX_REMOTE_HOOK_TOKEN || ""),
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
      },
      name: "xterm-256color",
    });
    proc.onData((data) => {
      this.appendBuffer(data);
      this.broadcast({ type: "output", data });
    });
    proc.onExit(({ exitCode, signal }) => {
      this.closed = true;
      this.broadcast({ type: "exit", code: exitCode, signal });
      terminalSessions.delete(terminalKeyFor(this.threadId, this.cwd));
    });
    return proc;
  }

  appendBuffer(data) {
    this.noteActivity();
    this.buffer += data;
    if (this.buffer.length > 240_000) this.buffer = this.buffer.slice(-200_000);
  }

  addClient(ws) {
    this.cancelIdleCleanup();
    this.touchAccess();
    this.clients.add(ws);
    this.send(ws, { type: "status", text: "Codex CLI TUI に接続しました" });
    const state = sessionStateFor(this.threadId, this.cwd);
    if (state) this.send(ws, { type: "sessionState", state });
    if (this.buffer) this.send(ws, { type: "snapshot", data: this.buffer });
    ws.on("message", (data) => this.handleMessage(ws, data));
    ws.on("close", () => {
      this.clients.delete(ws);
      if (shouldScheduleIdleCleanup({ clientCount: this.clients.size })) {
        this.scheduleIdleCleanup();
        pruneIdleRetainedSessions(terminalSessions, (retained) => retained.terminate());
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
    this.terminate();
  }

  handleMessage(ws, raw) {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      this.send(ws, { type: "error", text: "invalid terminal message" });
      return;
    }
    this.touchAccess();
    if (msg.type === "input" && typeof msg.data === "string") {
      const state = sessionStateFor(this.threadId, this.cwd);
      const isInterrupt = isTerminalInterruptInput(msg.data);
      if (state?.status === "running" && !isInterrupt) {
        this.send(ws, { type: "status", text: "Codex 処理中のため、ターミナル入力を一時停止しています。" });
        return;
      }
      this.proc.write(msg.data);
      return;
    }
    if (msg.type === "resize") {
      const cols = Math.max(20, Number(msg.cols) || 100);
      const rows = Math.max(8, Number(msg.rows) || 30);
      try {
        this.proc.resize(cols, rows);
      } catch {}
      return;
    }
    if (msg.type === "terminate") {
      this.terminate();
    }
  }

  send(ws, payload) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
  }

  broadcast(payload) {
    for (const client of this.clients) this.send(client, payload);
  }

  terminate() {
    if (this.closed) return;
    this.closed = true;
    this.cancelIdleCleanup();
    try {
      this.proc.kill("SIGTERM");
    } catch {}
    terminalSessions.delete(terminalKeyFor(this.threadId, this.cwd));
  }
}

function getTerminalSession({ threadId, cwd, cols, rows }) {
  const key = terminalKeyFor(threadId, cwd);
  const existing = terminalSessions.get(key);
  if (existing && !existing.closed) return existing;
  const session = new TerminalPtySession({ threadId, cwd, cols, rows });
  terminalSessions.set(key, session);
  pruneIdleRetainedSessions(terminalSessions, (retained) => retained.terminate());
  return session;
}

function bindTerminalSocket(ws, { threadId, cwd, cols, rows }) {
  try {
    const bridge = findLiveBridge(bridges, threadId);
    if (bridge?.materialized === false && !process.env.CODEX_TERMINAL_BIN) {
      ws.send(JSON.stringify({ type: "error", text: "初回メッセージ後に Codex CLI TUI を開始します。" }));
      ws.close();
      return;
    }
    const session = getTerminalSession({ threadId, cwd, cols, rows });
    session.addClient(ws);
  } catch (error) {
    ws.send(JSON.stringify({ type: "error", text: error.message }));
    ws.close(1011, "terminal failed");
  }
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
      return;
    }
    if (url.pathname === "/api/codex-hook") {
      if (req.method !== "POST") {
        sendJson(res, 405, { error: "method not allowed" });
        return;
      }
      if (tokenRequired && req.headers["x-codex-remote-hook-token"] !== phoneToken) {
        sendJson(res, 401, { error: "invalid hook token" });
        return;
      }
      try {
        const payload = await readJsonBody(req);
        const state = updateSessionState(normalizeHookState(payload));
        sendJson(res, 200, { ok: true, state });
      } catch (error) {
        sendJson(res, 400, { error: error.message });
      }
      return;
    }
    if (url.pathname === "/api/threads") {
      if (!requireToken(url, phoneToken, res)) return;
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
      return;
    }
    if (url.pathname === "/api/live-threads") {
      if (!requireToken(url, phoneToken, res)) return;
      sendJson(res, 200, {
        data: liveThreadSummaries(bridges, { sessionStateFor }),
      });
      return;
    }
    if (url.pathname === "/api/models") {
      if (!requireToken(url, phoneToken, res)) return;
      try {
        const result = await appServerRequest("model/list", { limit: 80, includeHidden: false });
        sendJson(res, 200, result);
      } catch (error) {
        sendJson(res, 500, { error: error.message });
      }
      return;
    }
    if (url.pathname === "/api/plugins") {
      if (!requireToken(url, phoneToken, res)) return;
      try {
        const result = await appServerRequest("plugin/list", { cwds: [workdir] });
        sendJson(res, 200, result);
      } catch (error) {
        sendJson(res, 500, { error: error.message });
      }
      return;
    }
    if (url.pathname === "/api/config") {
      if (!requireToken(url, phoneToken, res)) return;
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
      return;
    }
    if (url.pathname === "/api/status") {
      if (!requireToken(url, phoneToken, res)) return;
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
      return;
    }
    if (url.pathname === "/api/history-sync") {
      if (!requireToken(url, phoneToken, res)) return;
      const threadId = url.searchParams.get("thread");
      if (!threadId) {
        sendJson(res, 400, { error: "thread is required" });
        return;
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
      return;
    }
    if (url.pathname === "/api/thread") {
      if (!requireToken(url, phoneToken, res)) return;
      const threadId = url.searchParams.get("thread");
      if (!threadId) {
        sendJson(res, 400, { error: "thread is required" });
        return;
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
      return;
    }
    if (url.pathname === "/api/automations") {
      if (!requireToken(url, phoneToken, res)) return;
      sendJson(res, 200, { data: readAutomations() });
      return;
    }
    if (url.pathname === "/api/skills") {
      if (!requireToken(url, phoneToken, res)) return;
      sendJson(res, 200, { data: readSkills() });
      return;
    }
    if (url.pathname === "/api/fs/root") {
      if (!requireToken(url, phoneToken, res)) return;
      const home = safeDirectoryPath(os.homedir(), os.homedir());
      sendJson(res, 200, { root: home?.absolute || os.homedir() });
      return;
    }
    if (url.pathname === "/api/fs/list") {
      if (!requireToken(url, phoneToken, res)) return;
      const listing = readDirectoryListing(url.searchParams.get("path"), url.searchParams.get("hidden") === "1", os.homedir());
      if (!listing) {
        sendJson(res, 404, { error: "directory not found or outside home" });
        return;
      }
      sendJson(res, 200, listing);
      return;
    }
    if (url.pathname === "/api/artifacts") {
      if (!requireToken(url, phoneToken, res)) return;
      sendJson(res, 200, { data: discoverArtifacts() });
      return;
    }
    if (url.pathname === "/api/workspace") {
      if (!requireToken(url, phoneToken, res)) return;
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
      return;
    }
    if (url.pathname === "/api/review") {
      if (!requireToken(url, phoneToken, res)) return;
      try {
        sendJson(res, 200, await reviewSummary());
      } catch (error) {
        sendJson(res, 500, { error: error.message });
      }
      return;
    }
    if (url.pathname === "/api/uploaded") {
      if (!requireToken(url, phoneToken, res)) return;
      const target = safeUploadPath(url.searchParams.get("name"));
      if (!target || !fs.existsSync(target) || !fs.statSync(target).isFile() || !isImagePath(target)) {
        sendJson(res, 404, { error: "image not found" });
        return;
      }
      res.writeHead(200, { "content-type": mimeForPath(target), "cache-control": "no-store" });
      fs.createReadStream(target).pipe(res);
      return;
    }
    if (url.pathname === "/api/file/raw") {
      if (!requireToken(url, phoneToken, res)) return;
      const target = safeOpenPath(url.searchParams.get("path"));
      if (!target || !fs.existsSync(target) || !fs.statSync(target).isFile() || !isImagePath(target)) {
        sendJson(res, 404, { error: "image not found" });
        return;
      }
      res.writeHead(200, { "content-type": mimeForPath(target), "cache-control": "no-store" });
      fs.createReadStream(target).pipe(res);
      return;
    }
    if (url.pathname === "/api/file") {
      if (!requireToken(url, phoneToken, res)) return;
      const target = safeOpenPath(url.searchParams.get("path"));
      if (!target || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
        sendJson(res, 404, { error: "file not found" });
        return;
      }
      if (isImagePath(target)) {
        sendJson(res, 200, {
          path: relativeDisplayPath(target),
          kind: "image",
          mimeType: mimeForPath(target),
          imageUrl: `/api/file/raw?path=${encodeURIComponent(relativeDisplayPath(target))}`,
        });
        return;
      }
      sendJson(res, 200, {
        path: relativeDisplayPath(target),
        kind: /\.md(?:own)?$/i.test(target) ? "markdown" : "text",
        text: fs.readFileSync(target, "utf8").slice(0, 80_000),
      });
      return;
    }
    serveStatic(req, res);
  });

  const wss = new WebSocket.Server({ noServer: true });
  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname !== "/bridge" && url.pathname !== "/terminal") {
      socket.destroy();
      return;
    }
    if (tokenRequired && url.searchParams.get("token") !== phoneToken) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    const threadId = url.searchParams.get("thread") || null;
    const requestedCwd = url.searchParams.get("cwd");
    const safeCwd = requestedCwd ? safeDirectoryPath(requestedCwd, os.homedir()) : null;
    if (requestedCwd && !safeCwd) {
      socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
      socket.destroy();
      return;
    }
    if (url.pathname === "/terminal" && !threadId) {
      socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      if (url.pathname === "/terminal") {
        bindTerminalSocket(ws, {
          threadId,
          cwd: safeCwd?.absolute || workdir,
          cols: Number(url.searchParams.get("cols") || 100),
          rows: Number(url.searchParams.get("rows") || 30),
        });
        return;
      }
      bindBrowser(ws, phoneToken, threadId, { forceNew: url.searchParams.get("new") === "1", cwd: safeCwd?.absolute });
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
