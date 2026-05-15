const assert = require("node:assert/strict");
const test = require("node:test");
const { approvalResponseFor, prepareTurnStart } = require("./server/bridge-turn");

function sandboxPolicyForMode(mode, cwd) {
  return { type: mode, cwd };
}

test("prepareTurnStart builds text-only turn params", () => {
  const result = prepareTurnStart({
    threadId: "thread-1",
    text: "hello",
    saveDataUrlAttachment: () => null,
    sandboxPolicyForMode,
  });

  assert.deepEqual(result, {
    requestParams: {
      threadId: "thread-1",
      input: [{ type: "text", text: "hello", text_elements: [] }],
    },
    displayText: "hello",
    savedImages: [],
  });
});

test("prepareTurnStart appends saved image attachments and display names", () => {
  const result = prepareTurnStart({
    threadId: "thread-2",
    text: "look",
    attachments: [{ name: "a.png" }, { name: "skip.txt" }],
    saveDataUrlAttachment: (attachment) => {
      if (attachment.name !== "a.png") return null;
      return {
        input: { type: "localImage", path: "/tmp/a.png" },
        preview: { name: "a.png", path: "a.png", url: "/api/uploaded?name=a.png" },
      };
    },
    sandboxPolicyForMode,
  });

  assert.deepEqual(result.requestParams.input, [
    { type: "text", text: "look", text_elements: [] },
    { type: "localImage", path: "/tmp/a.png" },
  ]);
  assert.equal(result.displayText, "look\n\n添付: a.png");
  assert.deepEqual(result.savedImages, [{ name: "a.png", path: "a.png", url: "/api/uploaded?name=a.png" }]);
});

test("prepareTurnStart maps model approval and sandbox options", () => {
  const result = prepareTurnStart({
    threadId: "thread-3",
    text: "run",
    options: {
      model: "gpt-test",
      approvalPolicy: "on-request",
      sandboxMode: "workspace-write",
    },
    cwd: "/repo",
    saveDataUrlAttachment: () => null,
    sandboxPolicyForMode,
  });

  assert.equal(result.requestParams.model, "gpt-test");
  assert.equal(result.requestParams.approvalPolicy, "on-request");
  assert.deepEqual(result.requestParams.sandboxPolicy, { type: "workspace-write", cwd: "/repo" });
});

test("approvalResponseFor maps approval decisions to upstream JSON payloads", () => {
  assert.deepEqual(approvalResponseFor({ id: "1", method: "item/commandExecution/requestApproval" }, "accept"), {
    id: "1",
    result: { decision: "accept" },
  });
  assert.deepEqual(approvalResponseFor({ id: "2", method: "item/fileChange/requestApproval" }, "decline"), {
    id: "2",
    result: { decision: "decline" },
  });
  assert.deepEqual(approvalResponseFor({ id: "3", method: "other/requestApproval" }, "accept"), {
    id: "3",
    result: { decision: "accept" },
  });
});

test("approvalResponseFor ignores malformed request messages", () => {
  assert.equal(approvalResponseFor(null, "accept"), null);
  assert.equal(approvalResponseFor({ id: "1" }, "accept"), null);
  assert.equal(approvalResponseFor({ method: "item/fileChange/requestApproval" }, "accept"), null);
});
