#!/usr/bin/env node

const http = require("node:http");
const https = require("node:https");
const fs = require("node:fs");
const path = require("node:path");

const fallbackRoot = path.resolve(__dirname, "..");
const runtimePath = "remote-control-hook-runtime.json";

function hookRoot() {
  return process.env.CODEX_REMOTE_CONTROL_LAB_ROOT || fallbackRoot;
}

function debugLog(entry) {
  const root = hookRoot();
  const logPath = path.join(root, ".logs", "remote-control-hook.debug.log");
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);
  } catch {}
}

function readRuntimeConfig() {
  try {
    const filePath = path.join(hookRoot(), ".logs", runtimePath);
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

function resolveHookUrl(runtimeConfig) {
  if (process.env.CODEX_REMOTE_HOOK_URL) {
    return { value: process.env.CODEX_REMOTE_HOOK_URL, source: "env" };
  }
  if (typeof runtimeConfig.url === "string" && runtimeConfig.url) {
    return { value: runtimeConfig.url, source: "runtime" };
  }
  return { value: "", source: "" };
}

function resolveHookToken() {
  if (process.env.CODEX_REMOTE_HOOK_TOKEN) {
    return { value: process.env.CODEX_REMOTE_HOOK_TOKEN, source: "env" };
  }
  try {
    const token = fs.readFileSync(path.join(hookRoot(), ".phone-token"), "utf8").trim();
    return { value: token, source: token ? "file" : "" };
  } catch {
    return { value: "", source: "" };
  }
}

function readStdin() {
  return new Promise((resolve) => {
    let body = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      body += chunk;
    });
    process.stdin.on("end", () => resolve(body));
  });
}

function postJson(urlText, token, payload) {
  return new Promise((resolve) => {
    let url;
    try {
      url = new URL(urlText);
    } catch {
      resolve(false);
      return;
    }
    const client = url.protocol === "https:" ? https : http;
    const data = Buffer.from(JSON.stringify(payload));
    const req = client.request(
      url,
      {
        method: "POST",
        timeout: 500,
        headers: {
          "content-type": "application/json",
          "content-length": String(data.length),
          "x-codex-remote-hook-token": token || "",
        },
      },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode >= 200 && res.statusCode < 300));
      },
    );
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.on("error", () => resolve(false));
    req.end(data);
  });
}

(async () => {
  const raw = await readStdin();
  let payload = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = {};
  }

  const runtimeConfig = readRuntimeConfig();
  const url = resolveHookUrl(runtimeConfig);
  const token = resolveHookToken();
  const posted = url.value ? await postJson(url.value, token.value, payload) : false;
  debugLog({
    event: payload.hook_event_name || payload.event || payload.type || "",
    sessionId: payload.session_id || payload.sessionId || payload.thread_id || payload.threadId || "",
    cwd: payload.cwd || "",
    hasUrl: Boolean(url.value),
    urlSource: url.source,
    hasToken: Boolean(token.value),
    tokenSource: token.source,
    posted,
  });

  if (posted && process.env.CODEX_REMOTE_HOOK_CONTINUE === "1" && payload.hook_event_name === "Stop") {
    process.stdout.write(JSON.stringify({ continue: true }));
  }
})().catch(() => {
  process.exitCode = 0;
});
