const test = require("node:test");
const assert = require("node:assert/strict");

const { createThreadHistory, stripUiDirectives, summarizeLiveItem } = require("./thread-history");

test("stripUiDirectives removes UI-only directive lines", () => {
  assert.equal(stripUiDirectives("hello\n::card{hidden}\n\n\nworld"), "hello\n\nworld");
});

test("createThreadHistory summarizes text and local upload images", () => {
  const history = createThreadHistory({
    root: "/repo",
    uploadDir: "/repo/.uploads",
    isImagePath: (filePath) => filePath.endsWith(".png"),
    limit: 10,
  });

  const result = history.historyFromThread({
    turns: [
      {
        items: [
          {
            type: "userMessage",
            content: [
              { type: "text", text: "確認して" },
              { type: "localImage", path: "/repo/.uploads/demo.png" },
            ],
          },
          { type: "agentMessage", text: "ok\n::debug{hidden}" },
        ],
      },
    ],
  });

  assert.deepEqual(result, [
    {
      type: "user",
      text: "確認して",
      attachments: [{ name: "demo.png", url: "/api/uploaded?name=demo.png" }],
    },
    { type: "assistant", text: "ok" },
  ]);
});

test("summarizeLiveItem keeps only user-visible live status events", () => {
  assert.equal(summarizeLiveItem({ type: "commandExecution", command: "date" }, "started"), "$ date");
  assert.equal(summarizeLiveItem({ type: "commandExecution", command: "date" }, "completed"), null);
  assert.equal(summarizeLiveItem({ type: "fileChange", status: "modified" }), "file changes: modified");
});
