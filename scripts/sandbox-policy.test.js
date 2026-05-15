const test = require("node:test");
const assert = require("node:assert/strict");

const { sandboxPolicyForMode } = require("./server/sandbox-policy");

test("sandboxPolicyForMode maps full access to dangerFullAccess", () => {
  assert.deepEqual(sandboxPolicyForMode("danger-full-access", "/tmp/work"), { type: "dangerFullAccess" });
});

test("sandboxPolicyForMode maps read-only to readOnly with network access", () => {
  assert.deepEqual(sandboxPolicyForMode("read-only", "/tmp/work"), { type: "readOnly", networkAccess: true });
});

test("sandboxPolicyForMode defaults to workspaceWrite for the selected cwd", () => {
  assert.deepEqual(sandboxPolicyForMode("confirm", "/tmp/work"), {
    type: "workspaceWrite",
    writableRoots: ["/tmp/work"],
    networkAccess: true,
    excludeTmpdirEnvVar: false,
    excludeSlashTmp: false,
  });
});
