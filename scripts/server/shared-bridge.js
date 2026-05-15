function createSharedBridgeClass(deps) {
  const {
    approvalResponseFor,
    appServerRequest,
    bridges,
    capHistory,
    createIdleRetentionTimer,
    createUpstreamWebSocket,
    defaultWorkdir,
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
    sessionStateFor,
    shouldDisposeIdleBridge,
    shouldPromoteBridgeKey,
    shouldScheduleIdleCleanup,
    summarizeItem,
    summarizeLiveItem,
    updateSessionState,
    webSocketOpenState,
  } = deps;

  return class SharedBridge {
    constructor(requestedThreadId, bridgeKey, options = {}) {
      this.requestedThreadId = requestedThreadId;
      this.bridgeKey = bridgeKey;
      this.cwd = options.cwd || defaultWorkdir;
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
        if (client.readyState === webSocketOpenState) client.send(body);
      }
    }

    emitTo(client, type, payload = {}) {
      if (client.readyState === webSocketOpenState) client.send(JSON.stringify({ type, ...payload }));
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
      const { requestParams, displayText, savedImages } = prepareTurnStart({
        threadId: this.threadId,
        text,
        attachments,
        options,
        cwd: this.cwd,
        saveDataUrlAttachment,
        sandboxPolicyForMode,
      });
      const id = this.request("turn/start", requestParams);
      this.pending.set(id, "turn/start");
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
      const response = approvalResponseFor(requestMsg, decision);
      if (!response) return;
      this.upstream.send(JSON.stringify(response));
      this.emit("status", { text: decision === "accept" ? "承認しました" : "拒否しました" });
    }
  };
}

module.exports = {
  createSharedBridgeClass,
};
