const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-phone-workdir-"));
const workdir = path.join(tempRoot, "active-workspace");
fs.mkdirSync(workdir, { recursive: true });
process.env.CODEX_WORKDIR = workdir;

const {
  clearLastThreadId,
  discoverWorkspaceEntries,
  isMissingThreadError,
  readLastThreadCwd,
  readLastThreadId,
  reviewSummary,
  safeOpenPath,
  writeLastThreadCwd,
  writeLastThreadId,
} = require("./start-phone");

function runGit(args) {
  const result = spawnSync("git", args, { cwd: workdir, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `git ${args.join(" ")} failed`);
  return result.stdout;
}

test("discoverWorkspaceEntries walks CODEX_WORKDIR instead of the bridge repo root", async () => {
  fs.writeFileSync(path.join(workdir, "active-only.md"), "# active\n", "utf8");
  fs.writeFileSync(path.join(workdir, ".env"), "SECRET=hidden\n", "utf8");

  const entries = await discoverWorkspaceEntries({ limit: 20 });
  const paths = entries.map((entry) => entry.path);

  assert.ok(paths.includes("active-only.md"));
  assert.ok(!paths.includes(".env"));
});

test("safeOpenPath prefers same-named files from CODEX_WORKDIR", () => {
  const activeReadme = path.join(workdir, "README.md");
  fs.writeFileSync(activeReadme, "# active workspace\n", "utf8");

  assert.equal(safeOpenPath("README.md"), activeReadme);
});

test("reviewSummary marks CODEX_WORKDIR git paths as openable", async () => {
  runGit(["init"]);
  runGit(["config", "user.email", "test@example.com"]);
  runGit(["config", "user.name", "Test User"]);
  fs.writeFileSync(path.join(workdir, "review.md"), "before\n", "utf8");
  fs.writeFileSync(path.join(workdir, "review file.md"), "before\n", "utf8");
  runGit(["add", "review.md", "review file.md"]);
  runGit(["commit", "-m", "initial"]);
  fs.writeFileSync(path.join(workdir, "review.md"), "before\nafter\n", "utf8");
  fs.writeFileSync(path.join(workdir, "review file.md"), "before\nafter\n", "utf8");

  const summary = await reviewSummary();
  const reviewFile = summary.files.find((file) => file.path === "review.md");
  const spacedFile = summary.files.find((file) => file.path === "review file.md");

  assert.equal(summary.source, "working tree");
  assert.equal(reviewFile?.openable, true);
  assert.equal(reviewFile?.kind, "markdown");
  assert.equal(spacedFile?.openable, true);
  assert.equal(spacedFile?.additions, 1);
});

test("last-thread persistence writes, reads, and clears private local state", () => {
  const threadPath = path.join(tempRoot, "last-thread");
  const cwdPath = path.join(tempRoot, "last-thread-cwd");

  assert.equal(readLastThreadId(threadPath), "");
  assert.equal(readLastThreadCwd(cwdPath), "");

  writeLastThreadId("thread-123", threadPath);
  writeLastThreadCwd(workdir, cwdPath);

  assert.equal(readLastThreadId(threadPath), "thread-123");
  assert.equal(readLastThreadCwd(cwdPath), workdir);

  clearLastThreadId("other-thread", { threadPath, cwdPath });
  assert.equal(readLastThreadId(threadPath), "thread-123");

  clearLastThreadId("thread-123", { threadPath, cwdPath });
  assert.equal(readLastThreadId(threadPath), "");
  assert.equal(readLastThreadCwd(cwdPath), "");
});

test("missing thread errors are detected for stale resume recovery", () => {
  assert.equal(isMissingThreadError("no rollout found for thread id thread-123"), true);
  assert.equal(isMissingThreadError("Thread not found"), true);
  assert.equal(isMissingThreadError("connection closed"), false);
});
