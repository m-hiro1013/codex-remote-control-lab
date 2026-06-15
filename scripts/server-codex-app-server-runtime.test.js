const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("events");

const { AppServerRpcClient } = require("./server/codex-app-server-runtime");

test("AppServerRpcClient initializes once before forwarding requests", async () => {
  let socket;
  const sent = [];

  const client = new AppServerRpcClient({
    createUpstreamWebSocket: () => {
      socket = new EventEmitter();
      socket.readyState = 1;
      socket.send = (payload) => {
        const message = JSON.parse(payload);
        sent.push(message);
        if (message.id) {
          process.nextTick(() => {
            socket.emit("message", Buffer.from(JSON.stringify({ id: message.id, result: { method: message.method } })));
          });
        }
      };
      process.nextTick(() => socket.emit("open"));
      return socket;
    },
    timeoutMs: 100,
  });

  const result = await client.request("thread/list", { limit: 1 });

  assert.deepEqual(result, { method: "thread/list" });
  assert.deepEqual(sent.map((message) => message.method), ["initialize", "initialized", "thread/list"]);
  assert.deepEqual(sent[0].params.capabilities, { experimentalApi: true });
  assert.deepEqual(sent[2].params, { limit: 1 });
});

test("AppServerRpcClient rejects pending requests when the upstream closes", async () => {
  let socket;
  let slowRequestSent = false;

  const client = new AppServerRpcClient({
    createUpstreamWebSocket: () => {
      socket = new EventEmitter();
      socket.readyState = 1;
      socket.send = (payload) => {
        const message = JSON.parse(payload);
        if (message.method === "initialize") {
          process.nextTick(() => {
            socket.emit("message", Buffer.from(JSON.stringify({ id: message.id, result: {} })));
          });
        }
        if (message.method === "slow/request") {
          slowRequestSent = true;
          process.nextTick(() => socket.emit("close"));
        }
      };
      process.nextTick(() => socket.emit("open"));
      return socket;
    },
    timeoutMs: 1000,
  });

  await assert.rejects(client.request("slow/request", {}), /connection closed/);
  assert.equal(slowRequestSent, true);
});
