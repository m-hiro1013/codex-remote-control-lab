const test = require("node:test");
const assert = require("node:assert/strict");

const { sandboxPolicyForMode } = require("./sandbox-policy");

test("sandboxPolicyForMode maps explicit runtime modes", () => {
  assert.deepEqual(sandboxPolicyForMode("danger-full-access", "/tmp/demo"), { type: "dangerFullAccess" });
  assert.deepEqual(sandboxPolicyForMode("read-only", "/tmp/demo"), { type: "readOnly", networkAccess: true });
});

test("sandboxPolicyForMode defaults to workspace write rooted at workdir", () => {
  assert.deepEqual(sandboxPolicyForMode("workspace-write", "/tmp/demo"), {
    type: "workspaceWrite",
    writableRoots: ["/tmp/demo"],
    networkAccess: true,
    excludeTmpdirEnvVar: false,
    excludeSlashTmp: false,
  });
});
