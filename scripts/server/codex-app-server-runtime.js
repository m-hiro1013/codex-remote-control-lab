const http = require("http");
const net = require("net");
const path = require("path");
const { spawn } = require("child_process");
const WebSocket = require("ws");

class AppServerRpcClient {
  constructor({ createUpstreamWebSocket, timeoutMs = 8000 } = {}) {
    if (typeof createUpstreamWebSocket !== "function") throw new Error("createUpstreamWebSocket is required");
    this.createUpstreamWebSocket = createUpstreamWebSocket;
    this.timeoutMs = timeoutMs;
    this.upstream = null;
    this.nextId = 1;
    this.pending = new Map();
    this.ready = false;
    this.connecting = null;
  }

  request(method, params) {
    return this.ensureReady().then(() => this.sendRequest(method, params));
  }

  ensureReady() {
    if (this.ready && this.upstream?.readyState === WebSocket.OPEN) return Promise.resolve();
    if (this.connecting) return this.connecting;

    this.upstream = this.createUpstreamWebSocket();
    this.ready = false;
    this.connecting = new Promise((resolve, reject) => {
      const fail = (error) => {
        this.connecting = null;
        reject(error);
      };

      this.upstream.on("open", () => {
        this.sendRequest("initialize", {
          clientInfo: { name: "codex-phone-bridge-api", title: "Codex Phone Bridge API", version: "0.1.0" },
        })
          .then(() => {
            if (this.upstream?.readyState === WebSocket.OPEN) {
              this.upstream.send(JSON.stringify({ method: "initialized", params: {} }));
            }
            this.ready = true;
            this.connecting = null;
            resolve();
          })
          .catch(fail);
      });

      this.upstream.on("message", (data) => this.handleMessage(data));
      this.upstream.on("error", fail);
      this.upstream.on("close", () => this.reset(new Error("Codex app-server connection closed")));
    });

    return this.connecting;
  }

  sendRequest(method, params) {
    return new Promise((resolve, reject) => {
      if (!this.upstream || this.upstream.readyState !== WebSocket.OPEN) {
        reject(new Error("Codex app-server connection is not open"));
        return;
      }
      const id = this.nextId++;
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out`));
      }, this.timeoutMs);
      this.pending.set(id, { method, resolve, reject, timeout });
      this.upstream.send(JSON.stringify({ id, method, params }));
    });
  }

  handleMessage(data) {
    const msg = JSON.parse(data.toString());
    if (!msg.id || !this.pending.has(msg.id)) return;
    const pending = this.pending.get(msg.id);
    this.pending.delete(msg.id);
    clearTimeout(pending.timeout);
    if (msg.error) pending.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
    else pending.resolve(msg.result);
  }

  reset(error) {
    this.ready = false;
    this.connecting = null;
    this.upstream = null;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
  }
}

function createCodexAppServerRuntime(options = {}) {
  const {
    appServerArgs,
    codexBin,
    codexPort,
    codexSocketPath = "",
    codexUrl,
    env = process.env,
    hookEnvForToken = () => ({}),
    root,
    timeoutMs,
  } = options;
  if (typeof appServerArgs !== "function") throw new Error("appServerArgs is required");
  if (!codexBin) throw new Error("codexBin is required");
  if (!codexUrl) throw new Error("codexUrl is required");
  if (!root) throw new Error("root is required");

  function waitForReady() {
    const url = `http://127.0.0.1:${codexPort}/readyz`;
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const retry = () => {
        if (Date.now() - started > 10_000) reject(new Error("Codex app-server did not become ready"));
        else setTimeout(tick, 250);
      };
      const tick = () => {
        http
          .get(url, (res) => {
            res.resume();
            if (res.statusCode === 200) resolve();
            else retry();
          })
          .on("error", retry);
      };
      tick();
    });
  }

  function createUpstreamWebSocket() {
    if (!codexSocketPath) return new WebSocket(codexUrl);
    return new WebSocket(codexUrl, {
      perMessageDeflate: false,
      createConnection: () => net.createConnection(codexSocketPath),
    });
  }

  const appServerClient = new AppServerRpcClient({ createUpstreamWebSocket, timeoutMs });

  function startCodexServer(phoneToken = "") {
    const child = spawn(codexBin, appServerArgs(codexUrl), {
      cwd: root,
      env: {
        ...env,
        ...hookEnvForToken(phoneToken),
        PATH: `${path.join(root, "node_modules", ".bin")}:${env.PATH || ""}`,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (chunk) => process.stdout.write(`[codex] ${chunk}`));
    child.stderr.on("data", (chunk) => process.stderr.write(`[codex] ${chunk}`));
    child.on("exit", (code, signal) => {
      console.error(`[codex] exited code=${code} signal=${signal}`);
    });
    process.on("SIGINT", () => {
      child.kill("SIGINT");
      process.exit(0);
    });
    return child;
  }

  function appServerRequest(method, params) {
    return appServerClient.request(method, params);
  }

  return {
    appServerClient,
    appServerRequest,
    createUpstreamWebSocket,
    startCodexServer,
    waitForReady,
  };
}

module.exports = {
  AppServerRpcClient,
  createCodexAppServerRuntime,
};
