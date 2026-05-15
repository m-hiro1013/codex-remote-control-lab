const {
  isTerminalInterruptInput,
  terminalCodexArgs,
  terminalKeyFor,
} = require("./terminal-runtime");

function createTerminalPtyRuntime(options = {}) {
  const {
    codexSocketPath = "",
    codexTerminalBin,
    codexUrl = "",
    createIdleRetentionTimer,
    defaultWorkdir,
    env = process.env,
    findLiveBridge,
    pruneIdleRetainedSessions,
    pty,
    remoteHookEnv,
    retainedSessionConfig,
    sessionStateFor,
    shouldDisposeIdleBridge,
    shouldScheduleIdleCleanup,
    terminalSessions,
    webSocketOpenState = 1,
  } = options;

  class TerminalPtySession {
    constructor({ threadId, cwd, cols, rows }) {
      this.threadId = threadId;
      this.cwd = cwd || defaultWorkdir;
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
      const args = terminalCodexArgs({ threadId: this.threadId, cwd: this.cwd, codexSocketPath, codexUrl });
      const proc = pty.spawn(executable, args, {
        cwd: this.cwd,
        cols: Math.max(20, Number(cols) || 100),
        rows: Math.max(8, Number(rows) || 30),
        env: {
          ...env,
          ...remoteHookEnv(env.CODEX_REMOTE_HOOK_TOKEN || ""),
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
        terminalSessions.delete(terminalKeyFor(this.threadId, this.cwd, defaultWorkdir));
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
      if (ws.readyState === webSocketOpenState) ws.send(JSON.stringify(payload));
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
      terminalSessions.delete(terminalKeyFor(this.threadId, this.cwd, defaultWorkdir));
    }
  }

  function getTerminalSession({ threadId, cwd, cols, rows }) {
    const key = terminalKeyFor(threadId, cwd, defaultWorkdir);
    const existing = terminalSessions.get(key);
    if (existing && !existing.closed) return existing;
    const session = new TerminalPtySession({ threadId, cwd, cols, rows });
    terminalSessions.set(key, session);
    pruneIdleRetainedSessions(terminalSessions, (retained) => retained.terminate());
    return session;
  }

  function bindTerminalSocket(ws, { threadId, cwd, cols, rows }) {
    try {
      const bridge = findLiveBridge(threadId);
      if (bridge?.materialized === false && !env.CODEX_TERMINAL_BIN) {
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

  return {
    bindTerminalSocket,
    getTerminalSession,
    TerminalPtySession,
  };
}

module.exports = {
  createTerminalPtyRuntime,
};
