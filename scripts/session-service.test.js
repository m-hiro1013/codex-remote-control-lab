const test = require("node:test");
const assert = require("node:assert/strict");

const { createSessionService } = require("./server/session-service");

test("session service stores state by session id and cwd alias", () => {
  const service = createSessionService({
    bridges: new Map(),
    defaultCwd: "/repo",
    findLiveBridge: () => null,
    terminalSessions: new Map(),
    threadAliases: new Map(),
  });

  const state = service.update({
    sessionId: "thread-1",
    cwd: "/repo",
    status: "running",
    busy: true,
  });

  assert.equal(service.get("thread-1", "/repo"), state);
  assert.equal(service.get("", "/repo"), state);
  assert.deepEqual(service.list(), [state]);
});

test("session service drains queued bridge work after the session becomes idle", () => {
  let started = 0;
  const bridges = new Map([
    [
      "thread-1",
      {
        threadId: "thread-1",
        cwd: "/repo",
        startNextQueuedTurn() {
          started += 1;
        },
        noteActivity() {},
        emit() {},
      },
    ],
  ]);
  const service = createSessionService({
    bridges,
    defaultCwd: "/repo",
    findLiveBridge: () => bridges.get("thread-1"),
    terminalSessions: new Map(),
    threadAliases: new Map(),
  });

  service.update({
    sessionId: "thread-1",
    cwd: "/repo",
    status: "running",
    busy: true,
  });
  service.update({
    sessionId: "thread-1",
    cwd: "/repo",
    status: "input_ready",
    busy: false,
    completed: true,
  });

  assert.equal(started, 1);
});
