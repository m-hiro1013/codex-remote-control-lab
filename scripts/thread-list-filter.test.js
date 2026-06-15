const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ACTIVE_WINDOW_MS,
  isThreadWithinActiveWindow,
  shouldShowThreadInSidebar,
} = require("./thread-list-filter");

const now = Date.parse("2026-06-15T00:00:00.000Z");

test("isThreadWithinActiveWindow hides threads older than the active window", () => {
  assert.equal(
    isThreadWithinActiveWindow({ id: "old", updatedAt: now - ACTIVE_WINDOW_MS - 1 }, now),
    false,
  );
  assert.equal(
    isThreadWithinActiveWindow({ id: "recent", updatedAt: now - ACTIVE_WINDOW_MS + 1 }, now),
    true,
  );
});

test("isThreadWithinActiveWindow always shows pinned selected and live threads", () => {
  const oldTimestamp = now - ACTIVE_WINDOW_MS * 3;

  assert.equal(
    isThreadWithinActiveWindow({ id: "pinned", updatedAt: oldTimestamp }, now, {
      pinnedThreadIds: new Set(["pinned"]),
    }),
    true,
  );
  assert.equal(
    isThreadWithinActiveWindow({ id: "selected", updatedAt: oldTimestamp }, now, {
      selectedThread: "selected",
    }),
    true,
  );
  assert.equal(
    isThreadWithinActiveWindow({ id: "live-source", source: "live-bridge", updatedAt: oldTimestamp }, now),
    true,
  );
  assert.equal(
    isThreadWithinActiveWindow({ id: "live-status", status: "awaiting_approval", updatedAt: oldTimestamp }, now),
    true,
  );
});

test("shouldShowThreadInSidebar disables active window filtering for search or show all", () => {
  const old = { id: "old", updatedAt: now - ACTIVE_WINDOW_MS * 3 };

  assert.equal(shouldShowThreadInSidebar(old, now), false);
  assert.equal(shouldShowThreadInSidebar(old, now, { showAllThreads: true }), true);
  assert.equal(shouldShowThreadInSidebar(old, now, { hasSearchQuery: true }), true);
});
