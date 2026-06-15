const assert = require("node:assert/strict");
const test = require("node:test");

const {
  classifyComposerSubmit,
  getComposerCommandState,
  slashCommandCandidates,
} = require("./composer-command");

test("slashCommandCandidates filters commands by slash prefix", () => {
  assert.deepEqual(slashCommandCandidates("go").map((command) => command.value), ["/goal"]);
  assert.deepEqual(slashCommandCandidates("/sta").map((command) => command.value), ["/status"]);
});

test("getComposerCommandState only opens for slash at the current line head", () => {
  const state = getComposerCommandState("/re", 3);

  assert.equal(state.kind, "slash");
  assert.equal(state.replaceStart, 0);
  assert.equal(state.replaceEnd, 3);
  assert.deepEqual(state.candidates.map((command) => command.value), ["/review"]);
  assert.equal(getComposerCommandState("hello /re", 9).kind, "none");
  assert.equal(getComposerCommandState("first line\n/go", 14).kind, "slash");
});

test("classifyComposerSubmit routes shell, slash, and normal chat input", () => {
  assert.deepEqual(classifyComposerSubmit("$ ls -la"), { kind: "shell", command: "ls -la" });
  assert.deepEqual(classifyComposerSubmit("  $ pnpm test"), { kind: "shell", command: "pnpm test" });
  assert.equal(classifyComposerSubmit("/goal").kind, "slash");
  assert.deepEqual(classifyComposerSubmit("hello /goal"), { kind: "chat", text: "hello /goal" });
  assert.deepEqual(classifyComposerSubmit("hello"), { kind: "chat", text: "hello" });
});
