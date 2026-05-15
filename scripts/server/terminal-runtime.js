const path = require("path");

function terminalKeyFor(threadId, cwd, defaultCwd = "") {
  return `${threadId || "new"}:${path.resolve(cwd || defaultCwd || ".")}`;
}

function terminalCodexArgs({ threadId, cwd, codexSocketPath = "", codexUrl = "" } = {}) {
  const args = ["resume"];
  if (!codexSocketPath && codexUrl) args.push("--remote", codexUrl);
  args.push("-C", cwd);
  args.push(threadId);
  return args;
}

function isTerminalInterruptInput(data) {
  const text = String(data || "");
  return text === "\u001b" || text.includes("\u0003");
}

module.exports = {
  isTerminalInterruptInput,
  terminalCodexArgs,
  terminalKeyFor,
};
