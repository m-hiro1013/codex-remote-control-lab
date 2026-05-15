const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const test = require("node:test");
const { createBrowserSocketBinder } = require("./server/browser-socket");

function createBrowser() {
  const browser = new EventEmitter();
  browser.closed = false;
  browser.close = () => {
    browser.closed = true;
  };
  return browser;
}

test("bindBrowser attaches client and dispatches prompt and approval messages", () => {
  const calls = [];
  const bridge = {
    addClient: (browser) => calls.push(["addClient", browser]),
    approval: (request, decision) => calls.push(["approval", request, decision]),
    emitTo: () => {},
    prompt: (text, attachments, options) => calls.push(["prompt", text, attachments, options]),
  };
  const browser = createBrowser();
  const bindBrowser = createBrowserSocketBinder({
    getBridge: (threadId, connectionId, options) => {
      calls.push(["getBridge", threadId, connectionId, options]);
      return bridge;
    },
    randomUUID: () => "connection-1",
    tokenRequired: true,
  });

  bindBrowser(browser, "token", "thread-1", { forceNew: true });
  browser.emit("message", Buffer.from(JSON.stringify({ type: "prompt", token: "token", text: "hi", attachments: [], options: { model: "gpt" } })));
  browser.emit("message", Buffer.from(JSON.stringify({ type: "approval", token: "token", request: { id: "a" }, decision: "accept" })));

  assert.deepEqual(calls, [
    ["getBridge", "thread-1", "connection-1", { forceNew: true }],
    ["addClient", browser],
    ["prompt", "hi", [], { model: "gpt" }],
    ["approval", { id: "a" }, "accept"],
  ]);
});

test("bindBrowser rejects invalid token before dispatch", () => {
  const calls = [];
  const bridge = {
    addClient: () => calls.push(["addClient"]),
    approval: () => calls.push(["approval"]),
    emitTo: (browser, type, payload) => calls.push(["emitTo", type, payload]),
    prompt: () => calls.push(["prompt"]),
  };
  const browser = createBrowser();
  const bindBrowser = createBrowserSocketBinder({
    getBridge: () => bridge,
    randomUUID: () => "connection-2",
    tokenRequired: true,
  });

  bindBrowser(browser, "token", null);
  browser.emit("message", Buffer.from(JSON.stringify({ type: "prompt", token: "bad", text: "hi" })));

  assert.equal(browser.closed, true);
  assert.deepEqual(calls, [
    ["addClient"],
    ["emitTo", "error", { text: "Invalid token" }],
  ]);
});

test("bindBrowser allows tokenless debug mode", () => {
  const calls = [];
  const bridge = {
    addClient: () => {},
    approval: () => {},
    emitTo: () => {},
    prompt: (text) => calls.push(text),
  };
  const browser = createBrowser();
  const bindBrowser = createBrowserSocketBinder({
    getBridge: () => bridge,
    randomUUID: () => "connection-3",
    tokenRequired: false,
  });

  bindBrowser(browser, "", null);
  browser.emit("message", Buffer.from(JSON.stringify({ type: "prompt", text: "debug" })));

  assert.deepEqual(calls, ["debug"]);
  assert.equal(browser.closed, false);
});
