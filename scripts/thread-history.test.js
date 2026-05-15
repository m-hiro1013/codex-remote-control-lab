const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const {
  capHistory,
  historyFromThread,
  stripUiDirectives,
  summarizeItem,
  summarizeLiveItem,
} = require("./server/thread-history");

test("stripUiDirectives removes UI directive blocks and trims", () => {
  assert.equal(stripUiDirectives("hello\n::status{hidden}\n\n\nworld\n"), "hello\n\nworld");
});

test("summarizeItem maps user text and local image previews", () => {
  const root = "/repo";
  const uploadDir = "/repo/.uploads";
  assert.deepEqual(
    summarizeItem(
      {
        type: "userMessage",
        content: [
          { type: "text", text: "hello" },
          { type: "localImage", path: path.join(uploadDir, "image.png") },
          { type: "localImage", path: path.join(root, "docs", "asset.png") },
        ],
      },
      { root, uploadDir, isImagePath: (filePath) => filePath.endsWith(".png") },
    ),
    {
      type: "user",
      text: "hello",
      attachments: [
        { name: "image.png", url: "/api/uploaded?name=image.png" },
        { name: "asset.png", url: "/api/file/raw?path=docs%2Fasset.png" },
      ],
    },
  );
});

test("summarizeItem maps assistant, command, and file change entries", () => {
  assert.deepEqual(summarizeItem({ type: "agentMessage", text: "ok\n::tool{hidden}" }), { type: "assistant", text: "ok" });
  assert.deepEqual(summarizeItem({ type: "commandExecution", command: "git status" }), { type: "status", text: "$ git status" });
  assert.deepEqual(summarizeItem({ type: "fileChange", status: "modified" }), { type: "status", text: "file changes: modified" });
  assert.equal(summarizeItem({ type: "unknown" }), null);
});

test("summarizeLiveItem emits started command and completed file status", () => {
  assert.equal(summarizeLiveItem({ type: "commandExecution", command: "pwd" }, "started"), "$ pwd");
  assert.equal(summarizeLiveItem({ type: "commandExecution", command: "pwd" }, "completed"), null);
  assert.equal(summarizeLiveItem({ type: "fileChange", status: "changed" }, "completed"), "file changes: changed");
});

test("historyFromThread summarizes turns and caps history", () => {
  const thread = {
    turns: [
      { items: [{ type: "userMessage", content: [{ type: "text", text: "one" }] }] },
      { items: [{ type: "agentMessage", text: "two" }] },
      { items: [{ type: "commandExecution", command: "three" }] },
    ],
  };

  assert.deepEqual(historyFromThread(thread, { historyLimit: 2 }), [
    { type: "assistant", text: "two" },
    { type: "status", text: "$ three" },
  ]);
  assert.deepEqual(capHistory([1, 2, 3], 2), [2, 3]);
});
