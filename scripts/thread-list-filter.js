const ACTIVE_WINDOW_DAYS = 14;
const ACTIVE_WINDOW_MS = ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

const LIVE_THREAD_STATUSES = new Set(["running", "streaming", "syncing", "starting", "awaiting_approval", "approval"]);
const LIVE_THREAD_SOURCES = new Set(["live-bridge", "history-live"]);

function normalizeTimestamp(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
}

function latestThreadTimestamp(thread) {
  return Math.max(normalizeTimestamp(thread?.updatedAt), normalizeTimestamp(thread?.createdAt));
}

function containsId(collection, id) {
  if (!id || !collection) return false;
  if (collection instanceof Set) return collection.has(id);
  if (Array.isArray(collection)) return collection.includes(id);
  return false;
}

function isLiveLikeThread(thread) {
  if (!thread) return false;
  const status = String(thread.status || thread.sessionState?.status || "");
  const source = String(thread.source || "");
  return LIVE_THREAD_STATUSES.has(status) || LIVE_THREAD_SOURCES.has(source);
}

function isThreadWithinActiveWindow(thread, now = Date.now(), options = {}) {
  const threadId = String(thread?.id || thread?.threadId || "");
  if (containsId(options.pinnedThreadIds, threadId)) return true;
  if (threadId && threadId === String(options.selectedThread || "")) return true;
  if (isLiveLikeThread(thread)) return true;

  const timestamp = latestThreadTimestamp(thread);
  if (!timestamp) return false;
  const activeWindowMs = Number(options.activeWindowMs || ACTIVE_WINDOW_MS);
  return Number(now) - timestamp <= activeWindowMs;
}

function shouldShowThreadInSidebar(thread, now = Date.now(), options = {}) {
  if (options.showAllThreads || options.hasSearchQuery) return true;
  return isThreadWithinActiveWindow(thread, now, options);
}

if (typeof module !== "undefined") {
  module.exports = {
    ACTIVE_WINDOW_DAYS,
    ACTIVE_WINDOW_MS,
    isLiveLikeThread,
    isThreadWithinActiveWindow,
    latestThreadTimestamp,
    normalizeTimestamp,
    shouldShowThreadInSidebar,
  };
}
