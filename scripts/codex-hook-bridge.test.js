const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const test = require("node:test");
const { chromium } = require("playwright");
const WebSocket = require("ws");

const root = path.resolve(__dirname, "..");

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function waitForText(stream, pattern, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    let body = "";
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`timeout waiting for ${pattern}`));
    }, timeoutMs);
    const onData = (chunk) => {
      body += chunk.toString();
      if (pattern.test(body)) {
        cleanup();
        resolve(body);
      }
    };
    const cleanup = () => {
      clearTimeout(timer);
      stream.off("data", onData);
    };
    stream.on("data", onData);
  });
}

function startFakeAppServer() {
  const server = http.createServer();
  const wss = new WebSocket.Server({ server });
  wss.on("connection", (ws) => {
    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (!msg.id) return;
      if (msg.method === "thread/start") {
        ws.send(JSON.stringify({ id: msg.id, result: { thread: { id: "thread-hook", turns: [] } } }));
        return;
      }
      if (msg.method === "thread/resume") {
        ws.send(JSON.stringify({ id: msg.id, result: { thread: { id: msg.params.threadId, turns: [] } } }));
        return;
      }
      if (msg.method === "thread/list" || msg.method === "thread/loaded/list" || msg.method === "model/list") {
        ws.send(JSON.stringify({ id: msg.id, result: { data: [] } }));
        return;
      }
      ws.send(JSON.stringify({ id: msg.id, result: {} }));
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({
        url: `ws://127.0.0.1:${server.address().port}`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

function postJson(port, body) {
  const data = Buffer.from(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const req = http.request(
      `http://127.0.0.1:${port}/api/codex-hook`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": String(data.length),
        },
      },
      (res) => {
        let response = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          response += chunk;
        });
        res.on("end", () => resolve({ statusCode: res.statusCode, body: JSON.parse(response) }));
      },
    );
    req.on("error", reject);
    req.end(data);
  });
}

function getJson(port, pathname) {
  return new Promise((resolve, reject) => {
    const req = http.request(`http://127.0.0.1:${port}${pathname}`, (res) => {
      let response = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        response += chunk;
      });
      res.on("end", () => resolve({ statusCode: res.statusCode, body: JSON.parse(response) }));
    });
    req.on("error", reject);
    req.end();
  });
}

test("debug no-token bridges do not overwrite the canonical hook runtime fallback", { timeout: 15000 }, async () => {
  const fakeApp = await startFakeAppServer();
  const uiPort = await freePort();
  const runtimePath = path.join(root, ".logs", "remote-control-hook-runtime.json");
  const originalRuntime = fs.existsSync(runtimePath) ? fs.readFileSync(runtimePath, "utf8") : "";
  const sentinelRuntime = `${JSON.stringify({ url: "http://127.0.0.1:45214/api/codex-hook", uiPort: 45214 })}\n`;
  fs.mkdirSync(path.dirname(runtimePath), { recursive: true });
  fs.writeFileSync(runtimePath, sentinelRuntime, { mode: 0o600 });

  const child = spawn(process.execPath, ["scripts/start-phone.js"], {
    cwd: root,
    env: {
      ...process.env,
      PHONE_UI_PORT: String(uiPort),
      PHONE_DEBUG_NO_TOKEN: "1",
      CODEX_APP_SERVER_URL: fakeApp.url,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    await waitForText(child.stdout, /Codex shared browser bridge is ready\./);
    assert.equal(
      fs.readFileSync(runtimePath, "utf8"),
      sentinelRuntime,
      "一時 debug bridge が global hook fallback を上書きすると、実 hook が死んだ test port へ投稿してしまう",
    );
  } finally {
    child.kill("SIGTERM");
    if (originalRuntime) fs.writeFileSync(runtimePath, originalRuntime, { mode: 0o600 });
    await fakeApp.close();
  }
});

test("Codex hook endpoint broadcasts shared session state to bridge clients", { timeout: 15000 }, async () => {
  const fakeApp = await startFakeAppServer();
  const uiPort = await freePort();
  const child = spawn(process.execPath, ["scripts/start-phone.js"], {
    cwd: root,
    env: {
      ...process.env,
      PHONE_UI_PORT: String(uiPort),
      PHONE_DEBUG_NO_TOKEN: "1",
      CODEX_APP_SERVER_URL: fakeApp.url,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let ws;
  try {
    await waitForText(child.stdout, /Codex shared browser bridge is ready\./);
    ws = new WebSocket(`ws://127.0.0.1:${uiPort}/bridge`);
    const ready = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("bridge ready timeout")), 8000);
      ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "ready") {
          clearTimeout(timer);
          resolve(msg);
        }
      });
      ws.on("error", reject);
    });
    assert.equal(ready.threadId, "thread-hook");

    const statePromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("sessionState timeout")), 8000);
      ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "sessionState") {
          clearTimeout(timer);
          resolve(msg.state);
        }
      });
    });
    const response = await postJson(uiPort, {
      hook_event_name: "UserPromptSubmit",
      session_id: "thread-hook",
      turn_id: "turn-hook",
      cwd: root,
      prompt: "hello",
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.state.status, "running");
    const state = await statePromise;
    assert.equal(state.status, "running");
    assert.equal(state.sessionId, "thread-hook");
  } finally {
    if (ws) ws.close();
    child.kill("SIGTERM");
    await fakeApp.close();
  }
});

test("terminal resume hook should migrate the canonical live thread id for the same cwd", { timeout: 15000 }, async () => {
  const fakeApp = await startFakeAppServer();
  const uiPort = await freePort();
  const child = spawn(process.execPath, ["scripts/start-phone.js"], {
    cwd: root,
    env: {
      ...process.env,
      PHONE_UI_PORT: String(uiPort),
      PHONE_DEBUG_NO_TOKEN: "1",
      CODEX_APP_SERVER_URL: fakeApp.url,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let ws;
  try {
    await waitForText(child.stdout, /Codex shared browser bridge is ready\./);
    ws = new WebSocket(`ws://127.0.0.1:${uiPort}/bridge`);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("bridge ready timeout")), 8000);
      ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "ready") {
          clearTimeout(timer);
          resolve();
        }
      });
      ws.on("error", reject);
    });

    const migratedStatePromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("migrated sessionState timeout")), 8000);
      ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "sessionState" && msg.state?.sessionId === "thread-resumed") {
          clearTimeout(timer);
          resolve(msg.state);
        }
      });
    });

    const hookResponse = await postJson(uiPort, {
      hook_event_name: "Stop",
      session_id: "thread-resumed",
      turn_id: "turn-resumed",
      cwd: root,
    });
    assert.equal(hookResponse.statusCode, 200);

    const migratedState = await migratedStatePromise;
    assert.equal(migratedState.sessionId, "thread-resumed");
    assert.equal(migratedState.cwd, root);

    const liveThreads = await getJson(uiPort, "/api/live-threads");
    assert.equal(liveThreads.statusCode, 200);
    assert.equal(liveThreads.body.data.length, 1);
    assert.equal(
      liveThreads.body.data[0].id,
      "thread-resumed",
      "terminal resume 後は hook で観測した新 thread id が live-threads の canonical id に昇格してほしい",
    );
  } finally {
    if (ws) ws.close();
    child.kill("SIGTERM");
    await fakeApp.close();
  }
});

test("terminal resume migration rehomes the bridge key so reconnecting to the resumed id reuses the same bridge", { timeout: 15000 }, async () => {
  const fakeApp = await startFakeAppServer();
  const uiPort = await freePort();
  const child = spawn(process.execPath, ["scripts/start-phone.js"], {
    cwd: root,
    env: {
      ...process.env,
      PHONE_UI_PORT: String(uiPort),
      PHONE_DEBUG_NO_TOKEN: "1",
      CODEX_APP_SERVER_URL: fakeApp.url,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let firstWs;
  let secondWs;
  let staleWs;
  try {
    await waitForText(child.stdout, /Codex shared browser bridge is ready\./);
    firstWs = new WebSocket(`ws://127.0.0.1:${uiPort}/bridge`);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("first bridge ready timeout")), 8000);
      firstWs.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "ready" && msg.threadId === "thread-hook") {
          clearTimeout(timer);
          resolve();
        }
      });
      firstWs.on("error", reject);
    });

    const hookResponse = await postJson(uiPort, {
      hook_event_name: "Stop",
      session_id: "thread-resumed",
      turn_id: "turn-resumed",
      cwd: root,
    });
    assert.equal(hookResponse.statusCode, 200);

    secondWs = new WebSocket(`ws://127.0.0.1:${uiPort}/bridge?thread=thread-resumed`);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("second bridge ready timeout")), 8000);
      secondWs.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "ready" && msg.threadId === "thread-resumed") {
          clearTimeout(timer);
          resolve();
        }
      });
      secondWs.on("error", reject);
    });

    staleWs = new WebSocket(`ws://127.0.0.1:${uiPort}/bridge?thread=thread-hook`);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("stale bridge ready timeout")), 8000);
      staleWs.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "ready" && msg.threadId === "thread-resumed") {
          clearTimeout(timer);
          resolve();
        }
      });
      staleWs.on("error", reject);
    });

    const status = await getJson(uiPort, "/api/status");
    assert.equal(status.statusCode, 200);
    const resumedBridges = status.body.bridges.filter((bridge) => bridge.threadId === "thread-resumed");
    assert.equal(
      resumedBridges.length,
      1,
      "同じ cwd の terminal resume 後に resumed id へ再接続しても bridge は二重化しない",
    );
    assert.equal(resumedBridges[0].clients, 3);
  } finally {
    if (firstWs) firstWs.close();
    if (secondWs) secondWs.close();
    if (staleWs) staleWs.close();
    child.kill("SIGTERM");
    await fakeApp.close();
  }
});

test("browser follows terminal resume thread migration to the canonical live thread id", { timeout: 20000 }, async () => {
  const fakeApp = await startFakeAppServer();
  const uiPort = await freePort();
  const child = spawn(process.execPath, ["scripts/start-phone.js"], {
    cwd: root,
    env: {
      ...process.env,
      PHONE_UI_PORT: String(uiPort),
      PHONE_DEBUG_NO_TOKEN: "1",
      CODEX_APP_SERVER_URL: fakeApp.url,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let browser;
  try {
    await waitForText(child.stdout, /Codex shared browser bridge is ready\./);
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
    await page.goto(`http://127.0.0.1:${uiPort}`);
    await page.waitForFunction(() => window.location.search.includes("thread=thread-hook"));
    await page.waitForFunction(() => document.querySelectorAll(".thread-item.active").length === 1);

    const hookResponse = await postJson(uiPort, {
      hook_event_name: "Stop",
      session_id: "thread-resumed",
      turn_id: "turn-resumed",
      cwd: root,
    });
    assert.equal(hookResponse.statusCode, 200);

    await page.waitForFunction(async () => {
      const result = await fetch("/api/live-threads", { cache: "no-store" }).then((response) => response.json());
      return result?.data?.[0]?.id === "thread-resumed";
    });
    await page.waitForFunction(() => window.location.search.includes("thread=thread-resumed"));
    await page.waitForFunction(() => document.querySelectorAll(".thread-item.active").length === 1);

    const browserState = await page.evaluate(() => ({
      search: window.location.search,
      activeThreadCount: document.querySelectorAll(".thread-item.active").length,
      visibleThreadTitles: Array.from(document.querySelectorAll(".thread-item .thread-title")).map((node) => node.textContent.trim()),
      threadTitle: document.querySelector("#threadTitle")?.textContent?.trim() || "",
    }));

    assert.match(browserState.search, /thread=thread-resumed/);
    assert.equal(browserState.activeThreadCount, 1);
  } finally {
    if (browser) await browser.close();
    child.kill("SIGTERM");
    await fakeApp.close();
  }
});

test("browser migrates resume candidate to the canonical thread after terminal resume", { timeout: 20000 }, async () => {
  const fakeApp = await startFakeAppServer();
  const uiPort = await freePort();
  const child = spawn(process.execPath, ["scripts/start-phone.js"], {
    cwd: root,
    env: {
      ...process.env,
      PHONE_UI_PORT: String(uiPort),
      PHONE_DEBUG_NO_TOKEN: "1",
      CODEX_APP_SERVER_URL: fakeApp.url,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let browser;
  try {
    await waitForText(child.stdout, /Codex shared browser bridge is ready\./);
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
    await page.goto(`http://127.0.0.1:${uiPort}`);
    await page.waitForFunction(() => window.location.search.includes("thread=thread-hook"));
    await page.waitForFunction(() => document.querySelectorAll(".thread-item.active").length === 1);

    const hookResponse = await postJson(uiPort, {
      hook_event_name: "Stop",
      session_id: "thread-resumed",
      turn_id: "turn-resumed",
      cwd: root,
    });
    assert.equal(hookResponse.statusCode, 200);

    await page.waitForFunction(() => window.location.search.includes("thread=thread-resumed"));

    const storageState = await page.evaluate(() => {
      function readJson(key) {
        try {
          return JSON.parse(localStorage.getItem(key) || "null");
        } catch {
          return null;
        }
      }

      return {
        search: window.location.search,
        openSessions: readJson("codexRemoteOpenSessions"),
        activeSessionKey: localStorage.getItem("codexRemoteLastActiveSessionKey"),
        resumeCandidateSession: readJson("codexRemoteResumeSession"),
      };
    });

    assert.match(storageState.search, /thread=thread-resumed/);
    assert.deepEqual(
      storageState.openSessions.map((session) => session.threadId),
      ["thread-resumed"],
      "openSessions からは旧 thread-hook が外れ、新 canonical thread id だけが残る",
    );
    assert.equal(storageState.activeSessionKey, `thread-resumed::${root}`);
    assert.equal(
      storageState.resumeCandidateSession?.threadId,
      "thread-resumed",
      "resumeCandidateSession も新 canonical thread id へ追従してほしい",
    );
    assert.equal(storageState.resumeCandidateSession?.cwd, root);
  } finally {
    if (browser) await browser.close();
    child.kill("SIGTERM");
    await fakeApp.close();
  }
});

test("browser chrome follows hook-observed cwd for the active resumed thread", { timeout: 20000 }, async () => {
  const fakeApp = await startFakeAppServer();
  const uiPort = await freePort();
  const hookCwd = path.join(root, "hook-observed-project");
  const child = spawn(process.execPath, ["scripts/start-phone.js"], {
    cwd: root,
    env: {
      ...process.env,
      PHONE_UI_PORT: String(uiPort),
      PHONE_DEBUG_NO_TOKEN: "1",
      CODEX_APP_SERVER_URL: fakeApp.url,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let browser;
  try {
    await waitForText(child.stdout, /Codex shared browser bridge is ready\./);
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
    await page.goto(`http://127.0.0.1:${uiPort}`);
    await page.waitForFunction(() => window.location.search.includes("thread=thread-hook"));
    await page.waitForFunction(() => document.querySelector("#headerCwd")?.getAttribute("title")?.length > 0);

    const hookResponse = await postJson(uiPort, {
      hook_event_name: "Stop",
      session_id: "thread-hook",
      turn_id: "turn-cwd",
      cwd: hookCwd,
    });
    assert.equal(hookResponse.statusCode, 200);

    await page.waitForFunction(
      async (expectedCwd) => {
        const result = await fetch("/api/live-threads", { cache: "no-store" }).then((response) => response.json());
        return result?.data?.[0]?.id === "thread-hook" && result?.data?.[0]?.cwd === expectedCwd;
      },
      hookCwd,
    );

    await page.waitForFunction((expectedCwd) => document.querySelector("#headerCwd")?.getAttribute("title") === expectedCwd, hookCwd);

    const browserChrome = await page.evaluate(() => {
      function readJson(key) {
        try {
          return JSON.parse(localStorage.getItem(key) || "null");
        } catch {
          return null;
        }
      }

      const activeThread = document.querySelector(".thread-item.active");
      const activeProject = activeThread?.closest(".project-group")?.querySelector(".project-heading span:last-child")?.textContent?.trim() || "";
      return {
        headerCwdTitle: document.querySelector("#headerCwd")?.getAttribute("title") || "",
        terminalMeta: document.querySelector("#terminalSessionMeta")?.textContent || "",
        openSessions: readJson("codexRemoteOpenSessions"),
        activeProject,
      };
    });

    assert.equal(browserChrome.headerCwdTitle, hookCwd);
    assert.match(browserChrome.terminalMeta, /hook-observed-project/);
    assert.deepEqual(
      browserChrome.openSessions.map((session) => session.cwd),
      [hookCwd],
      "セッション切替 UI の cwd も hook が観測した実行 cwd に追従してほしい",
    );
    assert.equal(browserChrome.activeProject, "hook-observed-project");
  } finally {
    if (browser) await browser.close();
    child.kill("SIGTERM");
    await fakeApp.close();
  }
});
