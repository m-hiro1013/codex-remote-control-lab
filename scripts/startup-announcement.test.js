const assert = require("node:assert/strict");
const test = require("node:test");
const { createStartupAnnouncement } = require("./server/startup-announcement");

function captureConsole(fn) {
  const logs = [];
  const warns = [];
  const originalLog = console.log;
  const originalWarn = console.warn;
  console.log = (...args) => logs.push(args.join(" "));
  console.warn = (...args) => warns.push(args.join(" "));
  return Promise.resolve()
    .then(fn)
    .then((value) => ({ logs, value, warns }))
    .finally(() => {
      console.log = originalLog;
      console.warn = originalWarn;
    });
}

test("announceStartup prints tokenized URLs and notification results", async () => {
  const announceStartup = createStartupAnnouncement({
    bridgeUrls: (addresses, port, token) => addresses.map((address) => `http://${address}:${port}/?token=${token}`),
    codexSocketPath: "",
    codexUrl: "ws://127.0.0.1:45213",
    debugLan: false,
    listenHost: "0.0.0.0",
    model: "gpt-test",
    notifyBridgeUrls: async (urls) => [{ ok: true, type: "ntfy", urls }],
    shouldStartCodexServer: true,
    tokenRequired: true,
    uiPort: 45214,
    workdir: "/repo",
  });

  const { logs, value } = await captureConsole(() => announceStartup({ addresses: ["127.0.0.1"], phoneToken: "token" }));

  assert.deepEqual(value, [{ ok: true, type: "ntfy", urls: ["http://127.0.0.1:45214/?token=token"] }]);
  assert.ok(logs.includes("  http://127.0.0.1:45214/?token=token"));
  assert.ok(logs.includes("Auth:    token"));
  assert.ok(logs.includes("[notify] sent via ntfy"));
});

test("announceStartup skips notifications in tokenless debug mode", async () => {
  let notified = false;
  const announceStartup = createStartupAnnouncement({
    bridgeUrls: () => ["http://127.0.0.1:45214/"],
    codexSocketPath: "",
    codexUrl: "ws://127.0.0.1:45213",
    debugLan: false,
    listenHost: "127.0.0.1",
    model: "gpt-test",
    notifyBridgeUrls: async () => {
      notified = true;
      return [];
    },
    shouldStartCodexServer: false,
    tokenRequired: false,
    uiPort: 45214,
    workdir: "/repo",
  });

  const { logs, value } = await captureConsole(() => announceStartup({ addresses: ["127.0.0.1"], phoneToken: "" }));

  assert.deepEqual(value, []);
  assert.equal(notified, false);
  assert.ok(logs.includes("[notify] skipped in debug-no-token mode"));
});
