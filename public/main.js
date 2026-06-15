const log = document.querySelector("#log");
const meta = document.querySelector("#meta");
const headerCwd = document.querySelector("#headerCwd");
const pathbarColorPicker = document.querySelector("#pathbarColorPicker");
const connectButton = document.querySelector("#connect");
const newThreadButton = document.querySelector("#newThread");
const searchButton = document.querySelector("#searchButton");
const pluginsButton = document.querySelector("#pluginsButton");
const automationsButton = document.querySelector("#automationsButton");
const settingsButton = document.querySelector("#settingsButton");
const menuButton = document.querySelector("#menuButton");
const modeButtons = document.querySelectorAll("[data-main-mode]");
const terminalStatus = document.querySelector("#terminalStatus");
const terminalSessionMeta = document.querySelector("#terminalSessionMeta");
const terminalHost = document.querySelector("#terminalHost");
const terminalFallback = document.querySelector("#terminalFallback");
const terminalReconnect = document.querySelector("#terminalReconnect");
const terminalThemeToggle = document.querySelector("#terminalThemeToggle");
const terminalZoomOut = document.querySelector("#terminalZoomOut");
const terminalZoomIn = document.querySelector("#terminalZoomIn");
const terminalFontSizeLabel = document.querySelector("#terminalFontSizeLabel");
const terminalInputArea = document.querySelector("#terminalInputArea");
const terminalPrompt = document.querySelector("#terminalPrompt");
const terminalSend = document.querySelector("#terminalSend");
const terminalModeButtons = document.querySelectorAll("[data-terminal-input-mode]");
const terminalPanels = document.querySelectorAll("[data-terminal-panel]");
const terminalNativeInputButtons = document.querySelectorAll("[data-terminal-pty-input]");
const terminalActionButtons = document.querySelectorAll("[data-terminal-action]");
const terminalCtrlCButton = document.querySelector("[data-terminal-ctrl-c]");
const terminalCtrlCConfirm = document.querySelector("#terminalCtrlCConfirm");
const terminalCtrlCCancel = document.querySelector("#terminalCtrlCCancel");
const terminalCtrlCConfirmButton = document.querySelector("#terminalCtrlCConfirmButton");
const terminalFileInput = document.querySelector("#terminalFileInput");
const closePanelButton = document.querySelector("#closePanelButton");
const addButton = document.querySelector("#addButton");
const accessButton = document.querySelector("#accessButton");
const modelButton = document.querySelector("#modelButton");
const modelMenu = document.querySelector("#modelMenu");
const voiceButton = document.querySelector("#voiceButton");
const fileInput = document.querySelector("#fileInput");
const attachments = document.querySelector("#attachments");
const mobileThreadsButton = document.querySelector("#mobileThreads");
const sidebarScrim = document.querySelector("#sidebarScrim");
const sidebar = document.querySelector("#threadSidebar");
const artifactPanel = document.querySelector(".artifact-panel");
const artifactButtons = document.querySelectorAll("[data-artifact]");
const artifactTitle = document.querySelector("#artifactTitle");
const artifactList = document.querySelector("#artifactList");
const artifactPreview = document.querySelector("#artifactPreview");
const artifactTab = document.querySelector("#artifactTab");
const workspaceTab = document.querySelector("#workspaceTab");
const reviewTab = document.querySelector("#reviewTab");
const goalTab = document.querySelector("#goalTab");
const archiveTab = document.querySelector("#archiveTab");
const panelTabButtons = document.querySelectorAll("[data-panel-tab]");
const statusButton = document.querySelector("#statusButton");
const webSearchButton = document.querySelector("#webSearchButton");
const runState = document.querySelector("#runState");
const runStateLabel = document.querySelector("#runStateLabel");
const threadList = document.querySelector("#threadList");
const threadSearch = document.querySelector("#threadSearch");
const threadTitle = document.querySelector("#threadTitle");
const sessionSwitcher = document.querySelector("#sessionSwitcher");
const sessionCountPill = document.querySelector("#sessionCountPill");
const goalStatusPill = document.querySelector("#goalStatusPill");
const sessionSwipeHint = document.querySelector("#sessionSwipeHint");
const sessionSwipePrev = document.querySelector("#sessionSwipePrev");
const sessionSwipeLabel = document.querySelector("#sessionSwipeLabel");
const sessionSwipeNext = document.querySelector("#sessionSwipeNext");
const sessionCreatePage = document.querySelector("#sessionCreatePage");
const sessionCreateCancel = document.querySelector("#sessionCreateCancel");
const sessionSelectedCwd = document.querySelector("#sessionSelectedCwd");
const sessionRecentList = document.querySelector("#sessionRecentList");
const sessionRecentClear = document.querySelector("#sessionRecentClear");
const sessionBrowserUp = document.querySelector("#sessionBrowserUp");
const sessionBrowserPath = document.querySelector("#sessionBrowserPath");
const sessionBrowserList = document.querySelector("#sessionBrowserList");
const sessionDirectorySearch = document.querySelector("#sessionDirectorySearch");
const sessionStartButton = document.querySelector("#sessionStartButton");
const sessionHiddenToggle = document.querySelector("#sessionHiddenToggle");
const sessionSwitcherOverlay = document.querySelector("#sessionSwitcherOverlay");
const sessionSwitcherClose = document.querySelector("#sessionSwitcherClose");
const sessionSwitcherNew = document.querySelector("#sessionSwitcherNew");
const openSessionList = document.querySelector("#openSessionList");
const composer = document.querySelector("#composer");
const promptInput = document.querySelector("#prompt");
const sendButton = document.querySelector("#send");
const composerCommandHint = document.querySelector("#composerCommandHint");
const slashCommandMenu = document.querySelector("#slashCommandMenu");
const approval = document.querySelector("#approval");
const approvalText = document.querySelector("#approvalText");
const approveButton = document.querySelector("#approve");
const declineButton = document.querySelector("#decline");
const leftResizeHandle = document.querySelector("#leftResizeHandle");
const rightResizeHandle = document.querySelector("#rightResizeHandle");

const params = new URLSearchParams(location.search);
const token = params.get("token") || localStorage.getItem("codexPhoneToken") || "";
let selectedThread = params.get("thread") || "";
let tokenRequired = true;
let authMode = "token";
if (token) localStorage.setItem("codexPhoneToken", token);
if (params.has("token") && window.history?.replaceState) {
  const cleanUrl = new URL(location.href);
  cleanUrl.searchParams.delete("token");
  window.history.replaceState({}, document.title, cleanUrl);
}

const viewportMeta = document.querySelector('meta[name="viewport"]');
const stableViewportContent = viewportMeta?.getAttribute("content") || "width=device-width, initial-scale=1, viewport-fit=cover";
const resetViewportContent = stableViewportContent.includes("maximum-scale=1")
  ? stableViewportContent
  : `${stableViewportContent}, maximum-scale=1`;

function isTextInputElement(element) {
  if (!element) return false;
  if (element.tagName === "TEXTAREA") return true;
  if (element.tagName !== "INPUT") return false;
  return !["button", "checkbox", "color", "file", "hidden", "image", "radio", "range", "reset", "submit"].includes(element.type);
}

function resetViewportScaleAfterInput() {
  if (!viewportMeta || !window.visualViewport || window.visualViewport.scale <= 1.01) return;
  // iOS Safari は入力後の拡大状態を戻せないことがあるため、短時間だけ最大倍率を固定してから正規設定へ戻す。
  viewportMeta.setAttribute("content", resetViewportContent);
  requestAnimationFrame(() => {
    window.scrollTo(window.scrollX, window.scrollY);
    setTimeout(() => viewportMeta.setAttribute("content", stableViewportContent), 260);
  });
}

document.addEventListener(
  "focusout",
  (event) => {
    if (isTextInputElement(event.target)) resetViewportScaleAfterInput();
  },
  true,
);
window.addEventListener("orientationchange", () => setTimeout(resetViewportScaleAfterInput, 280));
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") resetViewportScaleAfterInput();
});

const logAutoScrollThresholdPx = 72;

function shouldAutoScrollLog() {
  if (!log) return false;
  const distanceFromBottom = log.scrollHeight - log.clientHeight - log.scrollTop;
  return distanceFromBottom <= logAutoScrollThresholdPx;
}

function forceScrollLogToBottom() {
  if (!log) return;
  log.scrollTop = log.scrollHeight;
}

function scrollLogToBottomIfNeeded(shouldScroll = shouldAutoScrollLog()) {
  if (!shouldScroll || !log) return;
  forceScrollLogToBottom();
}

function queueHistoryScrollToBottom() {
  forceScrollLogToBottom();
  requestAnimationFrame(() => requestAnimationFrame(() => forceScrollLogToBottom()));
}

const themeOptions = [
  { id: "simple", name: "シンプル", detail: "静かなローカルコンソール" },
  { id: "cyberpunk", name: "サイバーパンク", detail: "緑の端末文字 / 流れるコード背景" },
  { id: "botanical", name: "ボタニカル", detail: "グリーン / 温かみのあるクリーム" },
  { id: "stigmata", name: "Stigmata", detail: "氷青 / 銀白 / 赤い販売機の残光" },
];
let selectedTheme = localStorage.getItem("codexPhoneTheme") || "simple";

let ws = null;
let pendingApproval = null;
let assistantEntry = null;
let statusGroup = null;
let threadCache = [];
let liveTurnActive = false;
let remoteSessionState = null;
let lastHistorySignature = "";
let lastThreadListError = "";
let lastThreadRefreshError = "";
let lastTurnCompletedAt = 0;
let selectedThreadRefreshActive = false;
let reconnectTimer = null;
let reconnectAttempt = 0;
let selectedModel = localStorage.getItem("codexPhoneModel") || "";
let selectedModelLabel = localStorage.getItem("codexPhoneModelLabel") || "5.5";
let selectedReasoning = localStorage.getItem("codexPhoneReasoning") || "中";
let notificationsEnabled = localStorage.getItem("codexRemoteNotificationsEnabled") === "1";
let activeMainMode = localStorage.getItem("codexMainMode") || "chat";
let nativeTerminal = null;
let terminalLongPressActive = false;
const terminalFontSizes = [5, 6, 7, 8, 10, 12, 14, 16];
let terminalFontSize = Number(localStorage.getItem("codexTerminalFontSize")) || 6;
if (!terminalFontSizes.includes(terminalFontSize)) terminalFontSize = 6;
let terminalThemeMode = localStorage.getItem("codexTerminalThemeMode") === "light" ? "light" : "dark";
let terminalInputMode = localStorage.getItem("codexTerminalInputMode") === "keys" ? "keys" : "text";
let terminalCopyFallbackDialog = null;
let settingsRenderSeq = 0;
let artifactItems = [];
let archiveSelection = new Set();
let activeArtifactPath = "";
let activePanel = "artifacts";
let currentGoal = null;
let currentWorkdir = "";
let nextThreadCwd = "";
let forceNewThreadOnce = false;
const openSessionsStorageKey = "codexRemoteOpenSessions";
const activeSessionStorageKey = "codexRemoteLastActiveSessionKey";
const resumeSessionStorageKey = "codexRemoteResumeSession";
const cwdHistoryStorageKey = "codexRemoteCwdHistory";
const closedThreadIdsStorageKey = "codexRemoteClosedThreadIds";
const pinnedThreadIdsStorageKey = "codexRemotePinnedThreadIds";
const expandedThreadGroupsStorageKey = "codexRemoteExpandedThreadGroups";
const collapsedThreadGroupsStorageKey = "codexRemoteCollapsedThreadGroups";
const showAllThreadsStorageKey = "codexRemoteShowAllThreads";
const threadListFilterRuntime = window.CodexThreadListFilter || {};
const composerCommandRuntime = window.CodexComposerCommand || {};
const maxCwdHistory = 8;
let openSessions = [];
let activeSessionKey = "";
let resumeCandidateSession = null;
let cwdHistory = readCwdHistory();
let closedThreadIds = new Set();
let pinnedThreadIds = new Set();
let historyThreadCache = [];
let liveThreadCache = [];
let threadListLoaded = false;
let showAllThreads = localStorage.getItem(showAllThreadsStorageKey) === "1";
let sessionCreateCwd = localStorage.getItem("codexRemoteLastCwd") || "";
let sessionBrowserCurrentPath = sessionCreateCwd || "";
let sessionBrowserParentPath = "";
let sessionShowHidden = false;
let sessionBrowserEntries = [];
const pathbarColorStorageKey = "codexPathbarColorsByCwd";
const defaultPathbarColor = "#4f8cff";
let pathbarColorsByCwd = readPathbarColors();
let accessMode = {
  label: "フルアクセス",
  approvalPolicy: "never",
  sandboxMode: "danger-full-access",
};
const sessionStateRuntime = window.CodexSessionBrowserState;
if (!sessionStateRuntime?.createSessionStore) {
  throw new Error("browser-session-state.js is missing. Run pnpm build:ui.");
}
const sessionStore = sessionStateRuntime.createSessionStore({
  selectedThread,
  currentWorkdir,
  openSessions: readOpenSessions(),
  activeSessionKey: localStorage.getItem(activeSessionStorageKey) || "",
  resumeCandidateSession: readResumeSession(),
  closedThreadIds: readClosedThreadIds(),
  pinnedThreadIds: readPinnedThreadIds(),
});
syncSessionState(sessionStore.snapshot());
let pendingFiles = [];
let slashMenuState = {
  open: false,
  candidates: [],
  selectedIndex: 0,
  replaceStart: 0,
  replaceEnd: 0,
};

const panelWidthConfig = {
  left: { min: 188, max: 360, fallback: 232, storageKey: "codexLeftSidebarWidth", cssVar: "--thread-width" },
  right: { min: 280, max: 760, fallback: 420, storageKey: "codexRightSidebarWidth", cssVar: "--dock-width" },
};

const runStateText = {
  connecting: "接続中",
  ready: "待機中",
  running: "Codex 処理中",
  streaming: "回答生成中",
  approval: "承認待ち",
  syncing: "履歴同期中",
  done: "完了",
  disconnected: "切断",
  error: "エラー",
};

function isRemoteSessionRunning() {
  return remoteSessionState?.status === "running";
}

function setRunState(state, label) {
  if (!runState || !runStateLabel) return;
  const nextLabel = label || runStateText[state] || state;
  if (runState.dataset.state === state && runStateLabel.textContent === nextLabel) return;
  runState.dataset.state = state;
  runStateLabel.textContent = nextLabel;
}

const threadStatusUi = {
  running: ["running", runStateText.running],
  streaming: ["running", runStateText.streaming],
  syncing: ["running", runStateText.syncing],
  starting: ["running", "起動中"],
  awaiting_approval: ["approval", runStateText.approval],
  approval: ["approval", runStateText.approval],
  input_ready: ["idle", "入力待ち"],
  ready: ["idle", "入力待ち"],
  idle: ["idle", "履歴"],
  done: ["done", runStateText.done],
  completed: ["done", runStateText.done],
  error: ["error", runStateText.error],
  disconnected: ["error", runStateText.disconnected],
};

function statusClassForThread(status) {
  return threadStatusUi[String(status || "idle")]?.[0] || "idle";
}

function statusLabelForThread(status) {
  return threadStatusUi[String(status || "idle")]?.[1] || "履歴";
}

function adoptCanonicalSessionState(state) {
  syncSessionState(sessionStore.adoptRemoteState(state));
  persistSessionState();
  updateUrlThread();
  syncHeaderCwd();
  syncTerminalSessionMeta();
  renderSessionChrome();
}

function applyRemoteSessionState(state) {
  if (!state || typeof state !== "object") return;
  adoptCanonicalSessionState(state);
  remoteSessionState = state;
  syncSessionState(sessionStore.updateActiveSessionStatus(state.status));
  persistSessionState();
  renderSessionChrome();
  syncTerminalSessionMeta();
  if (state.status === "running") {
    liveTurnActive = true;
    setRunState("running", state.label || "Codex 処理中");
    return;
  }
  if (state.status === "awaiting_approval") {
    liveTurnActive = true;
    setRunState("approval", state.label || "承認待ち");
    return;
  }
  if (state.status === "input_ready" || state.status === "completed") {
    liveTurnActive = false;
    assistantEntry = null;
    setRunState("done", state.label || "入力待ち");
    if (!shouldHandleTurnCompleted()) return;
    maybeNotifyTurnCompleted();
    loadThreads();
    refreshSelectedThread();
  }
}

function applyTheme(themeId) {
  const nextTheme = themeOptions.some((theme) => theme.id === themeId) ? themeId : "simple";
  selectedTheme = nextTheme;
  document.documentElement.dataset.theme = nextTheme;
  localStorage.setItem("codexPhoneTheme", nextTheme);
}

applyTheme(selectedTheme);

function isHexColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || ""));
}

function readPathbarColors() {
  try {
    const parsed = JSON.parse(localStorage.getItem(pathbarColorStorageKey) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function pathbarColorKeyFor(cwd = currentWorkdir) {
  return cwd || "__default__";
}

function pathbarColorFor(cwd = currentWorkdir) {
  const saved = pathbarColorsByCwd[pathbarColorKeyFor(cwd)] || pathbarColorsByCwd.__default__;
  return isHexColor(saved) ? saved : defaultPathbarColor;
}

function textColorForBackground(hexColor) {
  const value = String(hexColor || "").replace("#", "");
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  const channels = [red, green, blue].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return luminance > 0.48 ? "#181713" : "#ffffff";
}

function applyPathbarColor(color = pathbarColorFor()) {
  const nextColor = isHexColor(color) ? color : defaultPathbarColor;
  document.documentElement.style.setProperty("--pathbar-color", nextColor);
  document.documentElement.style.setProperty("--user-bubble-color", nextColor);
  document.documentElement.style.setProperty("--user-bubble-text", textColorForBackground(nextColor));
  if (pathbarColorPicker) pathbarColorPicker.value = nextColor;
}

function savePathbarColorForCurrentWorkdir(color) {
  if (!isHexColor(color)) return;
  pathbarColorsByCwd[pathbarColorKeyFor()] = color;
  localStorage.setItem(pathbarColorStorageKey, JSON.stringify(pathbarColorsByCwd));
  applyPathbarColor(color);
  renderOpenSessionList();
}

applyPathbarColor();

function readJsonObjectArray(storageKey) {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === "object") : [];
  } catch {
    return [];
  }
}

function readStringSet(storageKey) {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string" && item) : []);
  } catch {
    return new Set();
  }
}

function readOpenSessions() {
  return readJsonObjectArray(openSessionsStorageKey)
    .map((item) => normalizeOpenSession(item))
    .filter(Boolean);
}

function readResumeSession() {
  try {
    return normalizeOpenSession(JSON.parse(localStorage.getItem(resumeSessionStorageKey) || "null"));
  } catch {
    return null;
  }
}

function readCwdHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(cwdHistoryStorageKey) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string").slice(0, maxCwdHistory) : [];
  } catch {
    return [];
  }
}

function readClosedThreadIds() {
  return readStringSet(closedThreadIdsStorageKey);
}

function readPinnedThreadIds() {
  return readStringSet(pinnedThreadIdsStorageKey);
}

function readExpandedThreadGroups() {
  return readStringSet(expandedThreadGroupsStorageKey);
}

let expandedThreadGroups = readExpandedThreadGroups();
let collapsedThreadGroups = readStringSet(collapsedThreadGroupsStorageKey);

function sessionKeyFor(threadId = "", cwd = "") {
  return sessionStateRuntime.sessionKeyFor(threadId, cwd);
}

function normalizeOpenSession(item) {
  return sessionStateRuntime.normalizeOpenSession(item);
}

function pushCwdHistory(cwd) {
  const nextCwd = String(cwd || "").trim();
  if (!nextCwd) return;
  cwdHistory = [nextCwd, ...cwdHistory.filter((item) => item !== nextCwd)].slice(0, maxCwdHistory);
  localStorage.setItem(cwdHistoryStorageKey, JSON.stringify(cwdHistory));
  localStorage.setItem("codexRemoteLastCwd", nextCwd);
}

function shortSessionPath(cwd) {
  const display = displayPath(cwd);
  const parts = String(display || "").split("/").filter(Boolean);
  if (parts.length <= 2) return display || "cwd未設定";
  return `.../${parts.slice(-2).join("/")}`;
}

function basenameForPath(cwd) {
  const trimmed = String(cwd || "").replace(/\/+$/, "");
  const parts = trimmed.split("/").filter(Boolean);
  return parts.at(-1) || trimmed || "New session";
}

function homeDirectoryForPath(value) {
  const text = String(value || "");
  const match = text.match(/^\/Users\/[^/]+(?=\/|$)/) || text.match(/^\/home\/[^/]+(?=\/|$)/);
  return match?.[0] || "";
}

function displayPath(value) {
  const text = String(value || "");
  const home = homeDirectoryForPath(text);
  if (!home) return text;
  return text === home ? "~" : `~${text.slice(home.length)}`;
}

function defaultDeveloperPath() {
  const candidates = [sessionCreateCwd, sessionBrowserCurrentPath, currentWorkdir, ...cwdHistory].filter(Boolean);
  for (const candidate of candidates) {
    const text = String(candidate);
    const marker = "/Developer";
    const index = text.indexOf(marker);
    if (index >= 0) return text.slice(0, index + marker.length);
  }
  return "";
}

function syncSessionState(snapshot) {
  selectedThread = snapshot.selectedThread;
  currentWorkdir = snapshot.currentWorkdir;
  openSessions = snapshot.openSessions;
  activeSessionKey = snapshot.activeSessionKey;
  resumeCandidateSession = snapshot.resumeCandidateSession;
  closedThreadIds = snapshot.closedThreadIds;
  pinnedThreadIds = snapshot.pinnedThreadIds;
}

function persistSessionState() {
  localStorage.setItem(openSessionsStorageKey, JSON.stringify(openSessions));
  if (activeSessionKey) localStorage.setItem(activeSessionStorageKey, activeSessionKey);
  else localStorage.removeItem(activeSessionStorageKey);
  if (resumeCandidateSession?.threadId) localStorage.setItem(resumeSessionStorageKey, JSON.stringify(resumeCandidateSession));
  else localStorage.removeItem(resumeSessionStorageKey);
  localStorage.setItem(closedThreadIdsStorageKey, JSON.stringify(Array.from(closedThreadIds)));
  localStorage.setItem(pinnedThreadIdsStorageKey, JSON.stringify(Array.from(pinnedThreadIds)));
}

function addOrUpdateOpenSession(input) {
  syncSessionState(
    sessionStore.addOrUpdateOpenSession({
      ...input,
      title: input.title || basenameForPath(input.cwd) || input.threadId,
    }),
  );
  persistSessionState();
  renderSessionChrome();
  return openSessions.find((session) => session.key === activeSessionKey) || null;
}

function syncOpenSessionsFromThreads() {
  syncSessionState(
    sessionStore.syncFromLiveThreads(liveThreadCache, {
      titleForThread,
    }),
  );
  persistSessionState();
  updateUrlThread();
  syncHeaderCwd();
  syncTerminalSessionMeta();
  renderSessionChrome();
}

function activeSessionIndex() {
  return openSessions.findIndex((session) => session.key === activeSessionKey);
}

function switchToOpenSession(sessionKey) {
  const previousKey = activeSessionKey;
  syncSessionState(sessionStore.activateSession(sessionKey));
  if (previousKey === activeSessionKey) return false;
  persistSessionState();
  updateUrlThread();
  renderSessionChrome();
  connect();
  return true;
}

function switchOpenSessionByOffset(offset) {
  if (openSessions.length < 2) return false;
  const current = Math.max(0, activeSessionIndex());
  const next = current + offset;
  if (next < 0 || next >= openSessions.length) return false;
  return switchToOpenSession(openSessions[next].key);
}

function removeOpenSession(sessionKey) {
  const previousThread = selectedThread;
  syncSessionState(sessionStore.removeSession(sessionKey));
  if (previousThread === selectedThread && !selectedThread) renderHistory([]);
  persistSessionState();
  updateUrlThread();
  if (previousThread !== selectedThread && selectedThread) connect();
  renderSessionChrome();
  renderOpenSessionList();
}

function renderSessionChrome() {
  const index = activeSessionIndex();
  const total = openSessions.length;
  const current = total ? Math.max(0, index) + 1 : 0;
  const hasPrev = total > 1 && current > 1;
  const hasNext = total > 1 && current < total;
  const label = total > 1 ? `${current}/${total} 稼働中` : total === 1 ? "1件のみ" : "稼働なし";
  if (sessionCountPill) sessionCountPill.textContent = total ? `${current}/${total}` : "0/0";
  if (sessionSwipeLabel) sessionSwipeLabel.textContent = label;
  sessionSwipePrev?.classList.toggle("active", hasPrev);
  sessionSwipeNext?.classList.toggle("active", hasNext);
  sessionSwipeHint?.classList.toggle("has-prev", hasPrev);
  sessionSwipeHint?.classList.toggle("has-next", hasNext);
  sessionSwitcher?.setAttribute(
    "aria-label",
    total > 1
      ? `稼働中スレッド ${current}/${total}。${hasPrev ? "右へスワイプで前へ。" : ""}${hasNext ? "左へスワイプで次へ。" : ""}タップで一覧を表示`
      : "開いているセッションを表示",
  );
  renderOpenSessionList();
}

function renderOpenSessionList() {
  if (!openSessionList) return;
  openSessionList.replaceChildren();
  if (!openSessions.length) {
    const empty = document.createElement("div");
    empty.className = "session-empty";
    empty.textContent = "開いているセッションはありません。";
    openSessionList.appendChild(empty);
    return;
  }
  for (const session of openSessions) {
    const row = document.createElement("div");
    row.className = session.key === activeSessionKey ? "session-card-row active" : "session-card-row";
    const card = document.createElement("button");
    card.type = "button";
    card.className = "session-card open-session-card";
    const sessionColor = pathbarColorFor(session.cwd);
    card.style.setProperty("--session-color", sessionColor);
    card.style.setProperty("--session-color-text", textColorForBackground(sessionColor));
    card.innerHTML = `
      <span class="session-color-chip" aria-hidden="true"></span>
      <span class="session-card-column session-card-directory">
        <span class="session-column-label">Directory</span>
        <span class="session-directory-name">${escapeHtml(basenameForPath(session.cwd))}</span>
        <span class="session-directory-fullpath">${escapeHtml(displayPath(session.cwd) || "cwd未設定")}</span>
      </span>
      <span class="session-card-column session-card-name">
        <span class="session-column-label">Session</span>
        <span class="session-card-title">${escapeHtml(session.title || basenameForPath(session.cwd))}</span>
        <span class="session-card-meta">${escapeHtml(session.status || "ready")} · ${escapeHtml(shortSessionPath(session.cwd))}</span>
      </span>
    `;
    const close = document.createElement("button");
    close.type = "button";
    close.className = "session-card-close";
    close.setAttribute("aria-label", `${session.title || session.threadId} を閉じる`);
    close.textContent = "×";
    card.addEventListener("click", () => {
      closeSessionSwitcher();
      switchToOpenSession(session.key);
    });
    close.addEventListener("click", () => removeOpenSession(session.key));
    row.append(card, close);
    openSessionList.appendChild(row);
  }
}

function openSessionSwitcher() {
  renderOpenSessionList();
  sessionSwitcherOverlay?.classList.remove("hidden");
}

function closeSessionSwitcher() {
  sessionSwitcherOverlay?.classList.add("hidden");
}

function restoreActiveSessionFromStorage() {
  const previousThread = selectedThread;
  syncSessionState(sessionStore.restoreFromLiveThreads(threadCache));
  if (!selectedThread) return false;
  if (previousThread === selectedThread) return true;
  persistSessionState();
  updateUrlThread();
  renderSessionChrome();
  return Boolean(selectedThread);
}

function setMainMode(mode) {
  const nextMode = mode === "terminal" ? "terminal" : "chat";
  activeMainMode = nextMode;
  document.body.dataset.mainMode = nextMode;
  localStorage.setItem("codexMainMode", nextMode);
  for (const button of modeButtons) {
    const active = button.dataset.mainMode === nextMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  }
  if (nextMode === "terminal") {
    syncTerminalSessionMeta();
    ensureNativeTerminalConnected();
  }
}

function applyTerminalTheme() {
  if (terminalThemeMode === "light") document.body.dataset.terminalMode = "light";
  else delete document.body.dataset.terminalMode;
  if (terminalThemeToggle) {
    terminalThemeToggle.textContent = terminalThemeMode === "light" ? "☀️" : "🌙";
    terminalThemeToggle.setAttribute(
      "aria-label",
      terminalThemeMode === "light" ? "ダークターミナルへ切り替え" : "ライトターミナルへ切り替え",
    );
  }
  nativeTerminal?.setThemeMode?.(terminalThemeMode);
}

function applyTerminalFontSize() {
  if (terminalFontSizeLabel) terminalFontSizeLabel.textContent = String(terminalFontSize);
  const index = terminalFontSizes.indexOf(terminalFontSize);
  if (terminalZoomOut) {
    terminalZoomOut.disabled = index <= 0;
    terminalZoomOut.classList.toggle("disabled", index <= 0);
  }
  if (terminalZoomIn) {
    terminalZoomIn.disabled = index >= terminalFontSizes.length - 1;
    terminalZoomIn.classList.toggle("disabled", index >= terminalFontSizes.length - 1);
  }
  nativeTerminal?.setFontSize?.(terminalFontSize);
}

function setTerminalInputMode(mode) {
  terminalInputMode = mode === "keys" ? "keys" : "text";
  localStorage.setItem("codexTerminalInputMode", terminalInputMode);
  for (const button of terminalModeButtons) {
    const active = button.dataset.terminalInputMode === terminalInputMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  }
  for (const panel of terminalPanels) {
    panel.classList.toggle("hidden", panel.dataset.terminalPanel !== terminalInputMode);
  }
}

const accessModes = [
  { label: "フルアクセス", approvalPolicy: "never", sandboxMode: "danger-full-access" },
  { label: "確認モード", approvalPolicy: "on-request", sandboxMode: "workspace-write" },
  { label: "読み取り専用", approvalPolicy: "on-request", sandboxMode: "read-only" },
];

const fontAwesomeIcons = {
  chevronDown: {
    viewBox: "0 0 448 512",
    path: "M201.4 406.6c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 338.7 54.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l192 192z",
  },
  folder: {
    viewBox: "0 0 512 512",
    path: "M64 448l384 0c35.3 0 64-28.7 64-64l0-240c0-35.3-28.7-64-64-64L298.7 80c-6.9 0-13.7-2.2-19.2-6.4L241.1 44.8C230 36.5 216.5 32 202.7 32L64 32C28.7 32 0 60.7 0 96L0 384c0 35.3 28.7 64 64 64z",
  },
  folderPlus: {
    viewBox: "0 0 512 512",
    path: "M512 384c0 35.3-28.7 64-64 64L64 448c-35.3 0-64-28.7-64-64L0 96C0 60.7 28.7 32 64 32l138.7 0c13.8 0 27.3 4.5 38.4 12.8l38.4 28.8c5.5 4.2 12.3 6.4 19.2 6.4L448 80c35.3 0 64 28.7 64 64l0 240zM256 160c-13.3 0-24 10.7-24 24l0 48-48 0c-13.3 0-24 10.7-24 24s10.7 24 24 24l48 0 0 48c0 13.3 10.7 24 24 24s24-10.7 24-24l0-48 48 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-48 0 0-48c0-13.3-10.7-24-24-24z",
  },
};

function fontAwesomeIcon(name, className) {
  const icon = fontAwesomeIcons[name];
  return `<svg class="${className}" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="${name}" role="img" viewBox="${icon.viewBox}" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="${icon.path}"></path></svg>`;
}

function setAccessButtonLabel() {
  accessButton.innerHTML = `<span class="access-label">${escapeHtml(accessMode.label)}</span>${fontAwesomeIcon("chevronDown", "button-chevron-icon")}`;
}

function updateModelButton() {
  modelButton.innerHTML = `<span class="model-button-label">${escapeHtml(`${selectedModelLabel} ${selectedReasoning}`)}</span>${fontAwesomeIcon("chevronDown", "button-chevron-icon")}`;
  modelButton.setAttribute("aria-label", `モデル ${selectedModelLabel}、インテリジェンス ${selectedReasoning}`);
  for (const row of modelMenu.querySelectorAll("[data-reasoning]")) {
    const active = row.dataset.reasoning === selectedReasoning;
    row.classList.toggle("active", active);
    row.setAttribute("aria-checked", String(active));
    let mark = row.querySelector(".checkmark");
    if (active && !mark) {
      mark = document.createElement("span");
      mark.className = "checkmark";
      mark.textContent = "✓";
      row.appendChild(mark);
    } else if (!active && mark) {
      mark.remove();
    }
  }
  for (const row of modelMenu.querySelectorAll("[data-model-choice]")) {
    const active = row.dataset.modelChoice === selectedModel;
    row.classList.toggle("active", active);
    row.setAttribute("aria-checked", String(active));
  }
}

function closeModelMenu() {
  modelMenu.classList.add("hidden");
  modelButton.setAttribute("aria-expanded", "false");
}

function toggleModelMenu() {
  updateModelButton();
  modelMenu.classList.toggle("hidden");
  const expanded = String(!modelMenu.classList.contains("hidden"));
  modelButton.setAttribute("aria-expanded", expanded);
}

function selectReasoning(value) {
  selectedReasoning = value;
  localStorage.setItem("codexPhoneReasoning", value);
  updateModelButton();
  closeModelMenu();
  addStatus(`インテリジェンスを ${value} に設定しました。`);
}

function selectModel(model) {
  selectedModel = model;
  selectedModelLabel = model.replace(/^gpt-/, "").toUpperCase().replace(/^GPT-/, "");
  if (selectedModelLabel.startsWith("5.")) selectedModelLabel = selectedModelLabel;
  localStorage.setItem("codexPhoneModel", selectedModel);
  localStorage.setItem("codexPhoneModelLabel", selectedModelLabel);
  updateModelButton();
  closeModelMenu();
  addStatus(`モデルを ${model.toUpperCase()} に設定しました。次の送信から反映します。`);
}

function syncSidebarState({ focus = false } = {}) {
  const open = document.body.classList.contains("show-sidebar");
  mobileThreadsButton.setAttribute("aria-expanded", String(open));
  sidebar?.setAttribute("aria-hidden", String(!open && window.matchMedia("(max-width: 820px)").matches));
  if (open && focus) {
    const target = sidebar?.querySelector("button, input, [href], [tabindex]:not([tabindex='-1'])");
    target?.focus();
  }
}

function openSidebar({ focus = false } = {}) {
  document.body.classList.add("show-sidebar");
  syncSidebarState({ focus });
}

function closeSidebar({ restoreFocus = false } = {}) {
  const wasOpen = document.body.classList.contains("show-sidebar");
  document.body.classList.remove("show-sidebar");
  syncSidebarState();
  if (restoreFocus && wasOpen) mobileThreadsButton.focus();
}

function syncRightPanelState({ focus = false } = {}) {
  const open = !document.body.classList.contains("hide-artifacts") || document.body.classList.contains("show-panel");
  menuButton.setAttribute("aria-pressed", String(open));
  menuButton.setAttribute("aria-expanded", String(open));
  artifactPanel?.setAttribute("aria-hidden", String(!open));
  if (open && focus) {
    const target = artifactPanel?.querySelector("button, input, textarea, [href], [tabindex]:not([tabindex='-1'])");
    target?.focus();
  }
}

function titleForThread(thread) {
  const raw = String(thread.name || thread.preview || thread.cwd || thread.id || "");
  const firstLine = raw.split("\n").find(Boolean) || thread.id || "";
  return firstLine.length > 54 ? `${firstLine.slice(0, 54)}...` : firstLine;
}

function projectForThread(thread) {
  const cwd = String(thread.cwd || "").replace(/\/+$/, "");
  if (!cwd) return "No project";
  return cwd.split("/").filter(Boolean).pop() || cwd;
}

function projectKeyForThread(thread) {
  return String(thread.cwd || "").replace(/\/+$/, "") || "No project";
}

function mergeHistoryAndLiveThreads(historyThreads = [], liveThreads = []) {
  const byId = new Map();
  for (const thread of historyThreads) {
    if (!thread?.id) continue;
    byId.set(thread.id, { ...thread, source: thread.source || "history" });
  }
  for (const live of liveThreads) {
    if (!live?.id) continue;
    const previous = byId.get(live.id) || {};
    byId.set(live.id, {
      ...previous,
      ...live,
      name: live.name || previous.name || null,
      preview: live.preview || previous.preview || "",
      cwd: live.cwd || previous.cwd || "",
      updatedAt: Math.max(Number(live.updatedAt || 0), Number(previous.updatedAt || 0)) || live.updatedAt || previous.updatedAt,
      createdAt: previous.createdAt || live.createdAt,
      status: live.status || previous.status || "idle",
      source: previous.id ? "history-live" : "live-bridge",
    });
  }
  return Array.from(byId.values()).sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0));
}

function setThreadCaches({ history = historyThreadCache, live = liveThreadCache } = {}) {
  historyThreadCache = Array.isArray(history) ? history : [];
  liveThreadCache = Array.isArray(live) ? live : [];
  threadCache = mergeHistoryAndLiveThreads(historyThreadCache, liveThreadCache);
  threadListLoaded = true;
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return "";
  const ms = timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp;
  const diffSeconds = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  const hours = Math.floor(diffSeconds / 3600);
  const days = Math.floor(diffSeconds / 86400);
  const months = Math.floor(days / 30);
  if (diffSeconds < 3600) return "今";
  if (hours < 24) return `${hours}時間`;
  if (days < 30) return `${days}日`;
  return `${months || 1}か月`;
}

function isBlockStart(line) {
  return (
    /^```/.test(line) ||
    /^#{1,4}\s+/.test(line) ||
    /^>\s?/.test(line) ||
    /^\s*[-*]\s+/.test(line) ||
    /^\s*\d+[.)]\s+/.test(line)
  );
}

function sanitizeHref(value) {
  try {
    const url = new URL(value, location.href);
    if (url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:") return url.href;
  } catch {
    return "";
  }
  return "";
}

function isImageHref(value) {
  return /\.(png|jpe?g|gif|webp|svg)(?:[?#].*)?$/i.test(String(value || ""));
}

function normalizeImageHref(value) {
  if (/^https?:\/\//i.test(value)) return value;
  const clean = String(value || "").replace(/^\.\//, "");
  if (clean.startsWith("/api/file/raw") || clean.startsWith("/api/uploaded")) return urlWithToken(clean);
  const localPath = clean.replace(/[?#].*$/, "");
  const repoImage = localPath.match(/(?:^|[/\\])(docs[/\\](?:assets|public)[/\\].+\.(?:png|jpe?g|gif|webp|svg))$/i);
  if (repoImage) {
    const relativeAsset = repoImage[1].replace(/\\/g, "/");
    return urlWithToken(`/api/file/raw?path=${encodeURIComponent(relativeAsset)}`);
  }
  if (/^[^?#]+\/[^?#]+\.(png|jpe?g|gif|webp|svg)(?:[?#].*)?$/i.test(clean)) {
    return urlWithToken(`/api/file/raw?path=${encodeURIComponent(localPath)}`);
  }
  if (/^[^/\\]+$/.test(clean) && isImageHref(clean)) {
    return urlWithToken(`/api/file/raw?path=${encodeURIComponent(`docs/assets/${clean}`)}`);
  }
  return value;
}

function sanitizeMarkdownHtml(html) {
  const allowedTags = new Set([
    "A",
    "B",
    "BR",
    "CODE",
    "DEL",
    "DETAILS",
    "DIV",
    "EM",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "IMG",
    "KBD",
    "P",
    "PRE",
    "S",
    "SPAN",
    "STRONG",
    "SUB",
    "SUMMARY",
    "SUP",
    "TABLE",
    "TBODY",
    "TD",
    "TH",
    "THEAD",
    "TR",
    "UL",
    "OL",
    "LI",
  ]);
  const template = document.createElement("template");
  template.innerHTML = html;

  const sanitizeNode = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) continue;
      if (child.nodeType !== Node.ELEMENT_NODE || !allowedTags.has(child.tagName)) {
        child.replaceWith(document.createTextNode(child.textContent || ""));
        continue;
      }

      for (const attribute of [...child.attributes]) {
        const name = attribute.name.toLowerCase();
        const value = attribute.value;
        if (name.startsWith("on") || name === "style" || name === "class" || name === "id") {
          child.removeAttribute(attribute.name);
          continue;
        }
        if (child.tagName === "A" && name === "href") {
          const safeHref = sanitizeHref(value);
          if (safeHref) {
            child.setAttribute("href", safeHref);
            child.setAttribute("target", "_blank");
            child.setAttribute("rel", "noreferrer");
          } else {
            child.removeAttribute(attribute.name);
          }
          continue;
        }
        if (child.tagName === "IMG" && name === "src") {
          child.setAttribute("src", normalizeImageHref(value));
          child.setAttribute("loading", "lazy");
          continue;
        }
        if (child.tagName === "IMG" && ["alt", "width", "height"].includes(name)) continue;
        if (["align", "colspan", "rowspan"].includes(name)) continue;
        child.removeAttribute(attribute.name);
      }

      sanitizeNode(child);
    }
  };

  sanitizeNode(template.content);
  return template.innerHTML;
}

function isHtmlBlockStart(line) {
  return /^<\/?(p|div|table|thead|tbody|tr|td|th|a|img|br|h[1-6]|details|summary)\b/i.test(line.trim());
}

function renderInlineMarkdown(text) {
  const codeTokens = [];
  const imageTokens = [];
  let source = String(text).replace(/`([^`]+)`/g, (_, code) => {
    const token = `\u0000CODE${codeTokens.length}\u0000`;
    codeTokens.push(escapeHtml(code));
    return token;
  });

  source = source.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, label, href) => {
    if (!isImageHref(href)) return _;
    const token = `\u0000IMAGE${imageTokens.length}\u0000`;
    imageTokens.push({ name: label || href.split("/").pop(), url: normalizeImageHref(href) });
    return token;
  });

  source = escapeHtml(source)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
      if (isImageHref(href)) {
        const token = `\u0000IMAGE${imageTokens.length}\u0000`;
        imageTokens.push({ name: label, url: normalizeImageHref(href) });
        return token;
      }
      const safeHref = sanitizeHref(href);
      if (!safeHref) return label;
      return `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noreferrer">${label}</a>`;
    })
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/(^|[\s(])_([^_\n]+)_/g, "$1<em>$2</em>");

  return source
    .replace(/\u0000CODE(\d+)\u0000/g, (_, index) => `<code>${codeTokens[Number(index)] || ""}</code>`)
    .replace(/\u0000IMAGE(\d+)\u0000/g, (_, index) => {
      const image = imageTokens[Number(index)];
      if (!image) return "";
      return `<figure class="image-preview markdown-image"><img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.name || "image")}" loading="lazy"><figcaption>${escapeHtml(image.name || "image")}</figcaption></figure>`;
    });
}

function renderMarkdown(text, options = {}) {
  const headingOffset = options.headingOffset ?? 1;
  const lines = String(text || "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (options.allowHtml && isHtmlBlockStart(line)) {
      const html = [line];
      const open = line.trim().match(/^<([a-z0-9]+)\b/i)?.[1]?.toLowerCase();
      index += 1;
      while (
        index < lines.length &&
        lines[index].trim() &&
        open &&
        !new RegExp(`</${open}>`, "i").test(html.join("\n"))
      ) {
        html.push(lines[index]);
        index += 1;
      }
      blocks.push(sanitizeMarkdownHtml(html.join("\n")));
      continue;
    }

    const fence = line.match(/^```\s*([a-z0-9_-]+)?\s*$/i);
    if (fence) {
      const code = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      const language = fence[1] ? ` data-language="${escapeHtml(fence[1])}"` : "";
      blocks.push(`<pre${language}><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const level = Math.min(heading[1].length + headingOffset, 6);
      blocks.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push(`<blockquote>${quote.map(renderInlineMarkdown).join("<br>")}</blockquote>`);
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*]\s+/, ""));
        index += 1;
      }
      blocks.push(`<ul>${items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ul>`);
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\s*\d+[.)]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+[.)]\s+/, ""));
        index += 1;
      }
      blocks.push(`<ol>${items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ol>`);
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index])) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push(`<p>${renderInlineMarkdown(paragraph.join(" "))}</p>`);
  }

  return blocks.join("");
}

function stripUiDirectives(text) {
  return String(text || "")
    .replace(/(?:^|\n)::[a-z0-9-]+\{[^\n]*\}(?=\n|$)/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function setEntryText(body, kind, text) {
  body.markdownSource = kind === "assistant" ? stripUiDirectives(text) : text || "";
  if (kind === "assistant" || kind === "user") body.innerHTML = renderMarkdown(body.markdownSource);
  else body.textContent = body.markdownSource;
}

function urlWithToken(url) {
  const target = new URL(url, location.href);
  if (tokenRequired && token) target.searchParams.set("token", token);
  return target.pathname + target.search;
}

function renderImageGallery(images = []) {
  if (!images.length) return null;
  const gallery = document.createElement("div");
  gallery.className = "image-gallery";
  for (const image of images) {
    const figure = document.createElement("figure");
    figure.className = "image-preview";
    const img = document.createElement("img");
    img.src = image.dataUrl || urlWithToken(image.url);
    img.alt = image.name || "添付画像";
    img.loading = "lazy";
    const caption = document.createElement("figcaption");
    caption.textContent = image.name || "image";
    figure.append(img, caption);
    gallery.appendChild(figure);
  }
  return gallery;
}

function diffStatLabel(file) {
  const additions = Number(file.additions || 0);
  const deletions = Number(file.deletions || 0);
  return `<span class="diff-add">+${additions}</span><span class="diff-del">-${deletions}</span>`;
}

function summarizeStatus(items) {
  if (items.some((item) => item.includes("音声入力"))) return "音声入力";
  const reads = items.filter((item) => /^Read\s+/i.test(item)).length;
  const commands = items.filter((item) => /command|コマンド|\$\s/.test(item)).length;
  const files = items.filter((item) => /file|ファイル/i.test(item)).length;
  const parts = [];
  if (reads) parts.push(`${reads}個のファイルを調査`);
  if (commands) parts.push(`${commands}件のコマンドを実行`);
  if (files && !reads) parts.push(`${files}件のファイル操作`);
  return parts.length ? parts.join("、") : `${items.length}件の作業ログ`;
}

function updateStatusGroup(group) {
  const count = group.items.length;
  group.summaryText.textContent = summarizeStatus(group.items);
  group.count.textContent = `${count}件`;
  group.list.replaceChildren(
    ...group.items.map((item) => {
      const row = document.createElement("li");
      row.textContent = item;
      return row;
    }),
  );
}

function addStatusGroupItem(text) {
  const shouldStickToBottom = shouldAutoScrollLog();
  if (!statusGroup || statusGroup.items.length >= 12) {
    const el = document.createElement("article");
    el.className = "entry status status-group";

    const avatar = document.createElement("div");
    avatar.className = "entry-avatar";
    avatar.textContent = "›";

    const details = document.createElement("details");
    details.className = "status-details";

    const summary = document.createElement("summary");
    const summaryText = document.createElement("span");
    summaryText.className = "status-summary-text";
    const count = document.createElement("span");
    count.className = "status-count";
    summary.append(summaryText, count);

    const list = document.createElement("ul");
    list.className = "status-list";
    details.append(summary, list);

    const tools = document.createElement("div");
    tools.className = "entry-tools";

    el.append(avatar, details, tools);
    log.appendChild(el);
    statusGroup = { items: [], summaryText, count, list };
  }
  statusGroup.items.push(text);
  updateStatusGroup(statusGroup);
  scrollLogToBottomIfNeeded(shouldStickToBottom);
}

function addEntry(kind, text, images = []) {
  if (kind === "status") {
    addStatusGroupItem(text);
    return null;
  }
  if (kind === "user" && !String(text || "").trim() && !images.length) return null;
  const shouldStickToBottom = shouldAutoScrollLog();
  statusGroup = null;
  const el = document.createElement("article");
  el.className = `entry ${kind}`;

  const avatar = document.createElement("div");
  avatar.className = "entry-avatar";
  avatar.textContent = kind === "user" ? "U" : kind === "assistant" ? "C" : "›";

  const body = document.createElement("div");
  body.className = "entry-body";
  setEntryText(body, kind, text);
  const gallery = kind === "user" ? renderImageGallery(images) : null;
  if (gallery) body.appendChild(gallery);

  const tools = document.createElement("div");
  tools.className = "entry-tools";
  if (kind === "assistant" || kind === "user") {
    tools.innerHTML = '<button type="button" class="entry-tool-button" data-message-action="copy" aria-label="メッセージをコピー" title="コピー"></button>';
  }

  el.append(avatar, body, tools);
  log.appendChild(el);
  scrollLogToBottomIfNeeded(shouldStickToBottom);
  return body;
}

function addStatus(text) {
  addStatusGroupItem(text);
}

function setReady(ready) {
  sendButton.disabled = !ready;
  promptInput.disabled = !ready;
}

function renderHistory(history) {
  log.replaceChildren();
  statusGroup = null;
  for (const entry of history || []) addEntry(entry.type, entry.text, entry.attachments || []);
  queueHistoryScrollToBottom();
}

function historySignature(history = []) {
  const items = Array.isArray(history) ? history : [];
  const sample = [items[0], items.at(-2), items.at(-1)].filter(Boolean);
  const sampleSignature = sample
    .map((entry) => `${entry.type || ""}:${String(entry.text || "").length}:${String(entry.text || "").slice(0, 80)}:${(entry.attachments || []).length}`)
    .join("|");
  return `${items.length}:${sampleSignature}`;
}

function renderHistoryIfChanged(history = []) {
  const signature = historySignature(history);
  if (signature === lastHistorySignature) return false;
  lastHistorySignature = signature;
  renderHistory(history);
  return true;
}

function renderThreadList() {
  threadList.replaceChildren();
  const query = threadSearch.value.trim().toLowerCase();
  const now = Date.now();
  const hasSearchQuery = Boolean(query);
  const filterOptions = {
    pinnedThreadIds,
    selectedThread,
    showAllThreads,
    hasSearchQuery,
  };
  const shouldShowThread = threadListFilterRuntime.shouldShowThreadInSidebar || (() => true);
  const toolbar = document.createElement("div");
  toolbar.className = "thread-list-toolbar";
  const newProject = document.createElement("button");
  newProject.type = "button";
  newProject.className = selectedThread ? "project-heading new-project" : "project-heading new-project active";
  newProject.innerHTML = `${fontAwesomeIcon("folderPlus", "project-icon")}<span>New project</span>`;
  newProject.addEventListener("click", startNewThread);
  const showAllToggle = document.createElement("button");
  showAllToggle.type = "button";
  showAllToggle.className = showAllThreads ? "thread-filter-chip active" : "thread-filter-chip";
  showAllToggle.setAttribute("aria-pressed", showAllThreads ? "true" : "false");
  showAllToggle.textContent = showAllThreads ? "すべて表示中" : "14日以内";
  showAllToggle.title = showAllThreads ? "古い履歴も表示中" : "14日より古い履歴は隠す";
  showAllToggle.addEventListener("click", () => {
    showAllThreads = !showAllThreads;
    localStorage.setItem(showAllThreadsStorageKey, showAllThreads ? "1" : "0");
    renderThreadList();
  });
  toolbar.append(newProject, showAllToggle);
  threadList.appendChild(toolbar);
  if (!threadListLoaded) {
    const skeleton = document.createElement("div");
    skeleton.className = "thread-list-skeleton";
    skeleton.innerHTML = "<span></span><span></span><span></span>";
    threadList.appendChild(skeleton);
    return;
  }

  const groups = new Map();
  const pinned = [];
  let hiddenOldCount = 0;
  for (const thread of threadCache) {
    const projectKey = projectKeyForThread(thread);
    const title = titleForThread(thread);
    const searchText = `${projectKey} ${projectForThread(thread)} ${title} ${thread.preview || ""} ${thread.id || ""}`.toLowerCase();
    const matches = !query || searchText.includes(query);
    if (!matches) continue;
    if (!shouldShowThread(thread, now, filterOptions)) {
      hiddenOldCount += 1;
      continue;
    }
    if (pinnedThreadIds.has(thread.id)) pinned.push(thread);
    if (!groups.has(projectKey)) groups.set(projectKey, []);
    groups.get(projectKey).push(thread);
  }

  const renderThreadRow = (group, thread) => {
    const row = document.createElement("div");
    row.className = thread.id === selectedThread ? "thread-row active" : "thread-row";
    const item = document.createElement("button");
    item.type = "button";
    item.className = thread.id === selectedThread ? "thread-item active" : "thread-item";
    item.title = titleForThread(thread);
    const status = document.createElement("span");
    status.className = `thread-status-dot ${statusClassForThread(thread.status)}`;
    status.setAttribute("aria-label", statusLabelForThread(thread.status));
    const title = document.createElement("span");
    title.className = "thread-title";
    title.textContent = titleForThread(thread);
    const time = document.createElement("span");
    time.className = "thread-time";
    time.textContent = formatRelativeTime(thread.updatedAt || thread.createdAt);
    item.append(status, title, time);
    item.addEventListener("click", () => selectThread(thread.id));
    const pin = document.createElement("button");
    pin.type = "button";
    pin.className = pinnedThreadIds.has(thread.id) ? "thread-pin active" : "thread-pin";
    pin.title = pinnedThreadIds.has(thread.id) ? "ピン留めを外す" : "ピン留め";
    pin.setAttribute("aria-label", `${titleForThread(thread)} ${pin.title}`);
    pin.textContent = pinnedThreadIds.has(thread.id) ? "★" : "☆";
    pin.addEventListener("click", (event) => {
      event.stopPropagation();
      syncSessionState(sessionStore.togglePinnedThread(thread.id));
      persistSessionState();
      renderThreadList();
    });
    row.append(item, pin);
    group.appendChild(row);
  };

  const renderGroup = (projectKey, threads, options = {}) => {
    const group = document.createElement("section");
    group.className = "project-group";

    const heading = document.createElement("div");
    heading.className = "project-heading";
    heading.setAttribute("role", "button");
    heading.tabIndex = 0;
    const folder = document.createElement("span");
    folder.className = "project-icon-slot";
    folder.innerHTML = fontAwesomeIcon("folder", "project-icon");
    const name = document.createElement("span");
    name.textContent = options.label || projectForThread({ cwd: projectKey });
    if (projectKey !== "No project") name.title = projectKey;
    heading.append(folder, name);
    group.appendChild(heading);

    const collapsed = collapsedThreadGroups.has(projectKey) && !options.alwaysExpanded && !query;
    heading.addEventListener("click", () => {
      if (options.alwaysExpanded) return;
      if (collapsedThreadGroups.has(projectKey)) collapsedThreadGroups.delete(projectKey);
      else collapsedThreadGroups.add(projectKey);
      localStorage.setItem(collapsedThreadGroupsStorageKey, JSON.stringify(Array.from(collapsedThreadGroups)));
      renderThreadList();
    });
    heading.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      heading.click();
    });
    if (collapsed) {
      const empty = document.createElement("div");
      empty.className = "project-more";
      empty.textContent = `${threads.length}件`;
      group.appendChild(empty);
      threadList.appendChild(group);
      return;
    }

    const expanded = expandedThreadGroups.has(projectKey) || Boolean(query) || options.alwaysExpanded;
    const visibleThreads = expanded ? threads : threads.slice(0, 6);
    for (const thread of visibleThreads) {
      renderThreadRow(group, thread);
    }

    if (threads.length > visibleThreads.length) {
      const more = document.createElement("button");
      more.type = "button";
      more.className = "project-more";
      more.textContent = `もっと表示する (${threads.length - visibleThreads.length})`;
      more.addEventListener("click", () => {
        expandedThreadGroups.add(projectKey);
        localStorage.setItem(expandedThreadGroupsStorageKey, JSON.stringify(Array.from(expandedThreadGroups)));
        renderThreadList();
      });
      group.appendChild(more);
    } else if (!visibleThreads.length) {
      const empty = document.createElement("div");
      empty.className = "project-empty";
      empty.textContent = "チャットはありません";
      group.appendChild(empty);
    }
    threadList.appendChild(group);
  };

  if (pinned.length) {
    const uniquePinned = Array.from(new Map(pinned.map((thread) => [thread.id, thread])).values());
    renderGroup("__pinned__", uniquePinned, { label: "📌 ピン留め", alwaysExpanded: true });
  }

  for (const [projectKey, threads] of groups) {
    renderGroup(projectKey, threads);
  }

  if (!showAllThreads && !hasSearchQuery && hiddenOldCount > 0) {
    const hidden = document.createElement("button");
    hidden.type = "button";
    hidden.className = "project-more thread-hidden-history";
    hidden.textContent = `他に ${hiddenOldCount} 件（古い履歴）`;
    hidden.addEventListener("click", () => {
      showAllThreads = true;
      localStorage.setItem(showAllThreadsStorageKey, "1");
      renderThreadList();
    });
    threadList.appendChild(hidden);
  }
}

function authQuery() {
  return tokenRequired && token ? `token=${encodeURIComponent(token)}` : "";
}

async function apiGet(path) {
  const separator = path.includes("?") ? "&" : "?";
  const query = authQuery();
  const response = await fetch(query ? `${path}${separator}${query}` : path, { cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `${response.status} ${response.statusText}`);
  return result;
}

async function apiPost(path, body = {}) {
  const separator = path.includes("?") ? "&" : "?";
  const query = authQuery();
  const response = await fetch(query ? `${path}${separator}${query}` : path, {
    method: "POST",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `${response.status} ${response.statusText}`);
  return result;
}

async function loadBridgeInfo() {
  try {
    const info = await apiGet("/api/info");
    tokenRequired = info.tokenRequired !== false;
    authMode = info.authMode || (tokenRequired ? "token" : "debug-no-token");
    if (!tokenRequired) {
      localStorage.removeItem("codexPhoneToken");
      addStatus("デバッグモード: token なしで localhost bridge に接続します。");
    }
    return info;
  } catch (error) {
    addEntry("error", `bridge情報を読めませんでした: ${error.message}`);
    throw error;
  }
}

async function loadThreads({ background = false } = {}) {
  if (tokenRequired && !token) return;
  try {
    const [historyResult, liveResult] = await Promise.all([
      apiGet("/api/threads?limit=100"),
      apiGet("/api/live-threads"),
    ]);
    setThreadCaches({
      history: historyResult.data || [],
      live: liveResult.data || [],
    });
    syncOpenSessionsFromThreads();
    renderThreadList();
    lastThreadListError = "";
  } catch (error) {
    const message = error.message || String(error);
    if (message !== lastThreadListError) {
      lastThreadListError = message;
      addEntry("error", `thread一覧を読めませんでした: ${message}`);
    }
    if (!background) throw error;
  }
}

async function refreshLiveThreads({ background = true } = {}) {
  if (tokenRequired && !token) return;
  try {
    const result = await apiGet("/api/live-threads");
    setThreadCaches({ live: result.data || [] });
    syncOpenSessionsFromThreads();
    renderThreadList();
    lastThreadListError = "";
  } catch (error) {
    const message = error.message || String(error);
    if (message !== lastThreadListError) {
      lastThreadListError = message;
      addEntry("error", `live thread状態を読めませんでした: ${message}`);
    }
    if (!background) throw error;
  }
}

async function refreshSelectedThread() {
  if (!selectedThread || liveTurnActive || selectedThreadRefreshActive) return;
  if (!threadCache.some((thread) => thread.id === selectedThread)) {
    const resumable = resumeCandidateSession || readResumeSession();
    if (resumable?.threadId === selectedThread) return;
    clearSelectedThread({ reason: `稼働中ではないthreadの履歴表示を停止しました: ${selectedThread}` });
    return;
  }
  selectedThreadRefreshActive = true;
  try {
    const result = await apiGet(`/api/thread?thread=${encodeURIComponent(selectedThread)}`);
    if (result.threadId !== selectedThread) return;
    renderHistoryIfChanged(result.history || []);
    lastThreadRefreshError = "";
  } catch (error) {
    const message = error.message || String(error);
    if (recoverMissingSelectedThread(message)) return;
    if (message !== lastThreadRefreshError) {
      lastThreadRefreshError = message;
      addEntry("error", `thread更新を読めませんでした: ${message}`);
    }
  } finally {
    selectedThreadRefreshActive = false;
  }
}

async function loadArtifacts() {
  if (tokenRequired && !token) return;
  try {
    const result = await apiGet("/api/artifacts");
    renderArtifactIndex(result.data || []);
  } catch (error) {
    addEntry("error", `artifact一覧を読めませんでした: ${error.message}`);
  }
}

function updateUrlThread() {
  const next = new URL(location.href);
  if (selectedThread) next.searchParams.set("thread", selectedThread);
  else next.searchParams.delete("thread");
  history.replaceState(null, "", next);
}

function isMissingThreadError(message) {
  return /no rollout found for thread id|thread not found|no thread found/i.test(String(message || ""));
}

function clearSelectedThread({ reason = "" } = {}) {
  const result = sessionStore.clearSelectedThread();
  syncSessionState(result);
  const previousThread = result.previousThread;
  lastThreadRefreshError = "";
  liveTurnActive = false;
  selectedThreadRefreshActive = false;
  localStorage.removeItem("codexPhoneLastThread");
  persistSessionState();
  updateUrlThread();
  renderHistory([]);
  renderThreadList();
  threadTitle.textContent = "新しい共有thread";
  syncTerminalSessionMeta();
  if (reason) addEntry("status", reason);
  return previousThread;
}

function recoverMissingSelectedThread(message) {
  const staleThread = selectedThread;
  if (!staleThread || !isMissingThreadError(message)) return false;
  clearSelectedThread({ reason: `存在しないthreadを解除しました: ${staleThread}` });
  if (ws) {
    ws.close();
    ws = null;
  }
  connect();
  return true;
}

function syncReadyThread(threadId, options = {}) {
  if (!threadId) return;
  syncSessionState(
    sessionStore.syncReadyThread({
      threadId,
      cwd: currentWorkdir,
      title: basenameForPath(currentWorkdir),
      status: remoteSessionState?.status || "ready",
    }),
  );
  persistSessionState();
  updateUrlThread();
  const existingIndex = threadCache.findIndex((thread) => thread.id === threadId);
  const liveThread = {
    id: threadId,
    threadId,
    cwd: currentWorkdir,
    preview: "稼働中スレッド",
    status: remoteSessionState?.status || "ready",
    ready: true,
    updatedAt: Date.now(),
  };
  if (existingIndex >= 0) threadCache[existingIndex] = { ...threadCache[existingIndex], ...liveThread };
  else threadCache.unshift(liveThread);
  const selected = threadCache.find((thread) => thread.id === selectedThread);
  threadTitle.textContent = selected ? titleForThread(selected) : selectedThread;
  if (selected) {
    syncSessionState(
      sessionStore.syncReadyThread({
        threadId,
        cwd: currentWorkdir,
        title: titleForThread(selected),
        status: remoteSessionState?.status || "ready",
      }),
    );
    persistSessionState();
  }
  renderThreadList();
  renderSessionChrome();
  syncTerminalSessionMeta();
  if (options.prewarmTerminal) ensureNativeTerminalConnected({ focus: activeMainMode === "terminal" });
}

function selectThread(threadId) {
  if (!threadId) {
    const result = sessionStore.clearSelectedThread();
    syncSessionState(result);
    persistSessionState();
    updateUrlThread();
    renderThreadList();
    renderSessionChrome();
    closeSidebar();
    connect();
    return;
  }
  const nextThread = threadCache.find((thread) => thread.id === threadId);
  syncSessionState(sessionStore.selectLiveThread(nextThread, { titleForThread }));
  persistSessionState();
  updateUrlThread();
  renderThreadList();
  renderSessionChrome();
  closeSidebar();
  connect();
}

function setCurrentWorkdir(workdir) {
  syncSessionState(sessionStore.setCurrentWorkdir(workdir || currentWorkdir || ""));
  persistSessionState();
  applyPathbarColor();
  syncHeaderCwd();
  syncTerminalSessionMeta();
  if (activeMainMode === "terminal") ensureNativeTerminalConnected();
}

function syncHeaderCwd() {
  if (!headerCwd) return;
  const cwd = currentWorkdir || "準備中";
  headerCwd.textContent = currentWorkdir ? displayPath(currentWorkdir) : cwd;
  headerCwd.title = currentWorkdir || "";
}

function syncTerminalSessionMeta() {
  if (!terminalSessionMeta) return;
  const thread = selectedThread || "thread準備中";
  const cwd = currentWorkdir ? displayPath(currentWorkdir) : "cwd準備中";
  const stateLabel = remoteSessionState?.label ? `  •  ${remoteSessionState.label}` : "";
  terminalSessionMeta.textContent = `${thread}  •  ${cwd}${stateLabel}`;
}

function terminalSocketUrl({ threadId, cwd, cols, rows }) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const url = new URL(`${protocol}//${window.location.host}/terminal`);
  url.searchParams.set("thread", threadId);
  if (cwd) url.searchParams.set("cwd", cwd);
  if (token) url.searchParams.set("token", token);
  if (cols) url.searchParams.set("cols", String(cols));
  if (rows) url.searchParams.set("rows", String(rows));
  return url.toString();
}

function ensureNativeTerminalConnected(options = {}) {
  if (!terminalHost || !window.CodexNativeTerminal) {
    if (terminalFallback) {
      terminalFallback.textContent = "xterm bundle を読み込めませんでした。npm run build:ui を実行してください。";
      terminalFallback.classList.remove("hidden");
    }
    return false;
  }
  if (!selectedThread) {
    if (terminalFallback) {
      terminalFallback.textContent = "thread が準備できたら Codex CLI TUI を開始します。";
      terminalFallback.classList.remove("hidden");
    }
    return false;
  }
  if (!nativeTerminal) {
    nativeTerminal = new window.CodexNativeTerminal({
      host: terminalHost,
      fallback: terminalFallback,
      buildUrl: terminalSocketUrl,
      fontSize: terminalFontSize,
      themeMode: terminalThemeMode,
      onStatus: (text) => {
        if (terminalStatus) terminalStatus.textContent = text || "Codex Terminal";
      },
      onSessionState: applyRemoteSessionState,
      onLongPressActiveChange: (active) => {
        terminalLongPressActive = Boolean(active);
        document.body.classList.toggle("terminal-touch-lock", terminalLongPressActive);
      },
    });
  }
  return nativeTerminal.connect({
    threadId: selectedThread,
    cwd: currentWorkdir,
    force: Boolean(options.force),
    focus: options.focus ?? activeMainMode === "terminal",
  });
}

function sendNativeTerminalInput(data) {
  const decoded = String(data || "")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\u007f/g, "\x7f")
    .replace(/\\u001b/g, "\u001b")
    .replace(/\\u0003/g, "\u0003");
  if (isRemoteSessionRunning() && !decoded.includes("\u0003")) {
    addStatus("Codex 処理中のため、ターミナル入力を一時停止しています。");
    return false;
  }
  if (!nativeTerminal && !ensureNativeTerminalConnected()) return;
  nativeTerminal?.sendInput(decoded);
  nativeTerminal?.focus();
  return true;
}

function appendTerminalPromptLine(line) {
  if (!terminalPrompt || !line) return;
  const current = terminalPrompt.value || "";
  const separator = current && !current.endsWith("\n") ? "\n" : "";
  terminalPrompt.value = `${current}${separator}${line}\n`;
  setTerminalInputMode("text");
  terminalPrompt.focus();
}

function submitTerminalPrompt() {
  if (!terminalPrompt) return;
  const text = terminalPrompt.value;
  if (text.length === 0) {
    sendNativeTerminalInput("\r");
    return;
  }
  if (!sendNativeTerminalInput(text)) return;
  terminalPrompt.value = "";
  if (terminalSend) terminalSend.textContent = "Enter ↵";
  terminalPrompt.focus();
}

async function handleTerminalAction(action) {
  if (action === "cwd") {
    appendTerminalPromptLine(currentWorkdir || ".");
    return;
  }
  if (action === "attach") {
    terminalFileInput?.click();
    return;
  }
  if (action === "copy") {
    const text = nativeTerminal?.visibleText?.() || "";
    if (!text) {
      addStatus("コピーできるターミナル表示がありません。");
      return;
    }
    const copied = await copyTextToClipboard(text);
    if (copied) {
      if (terminalStatus) terminalStatus.textContent = "ターミナル表示をコピーしました";
      addStatus("ターミナル表示をコピーしました。");
      return;
    }
    showTerminalCopyFallback(text);
    if (terminalStatus) terminalStatus.textContent = "コピー用テキストを表示中";
    addStatus("ブラウザが自動コピーを拒否したため、コピー用テキストを表示しました。");
  }
}

function showTerminalCtrlCConfirm() {
  terminalCtrlCConfirm?.classList.remove("hidden");
}

function hideTerminalCtrlCConfirm() {
  terminalCtrlCConfirm?.classList.add("hidden");
}

function startNewThread() {
  openSessionCreatePage();
}

function startNewThreadInCwd(cwd) {
  forceNewThreadOnce = true;
  nextThreadCwd = cwd;
  pushCwdHistory(cwd);
  closeSessionCreatePage();
  selectThread("");
}

function openSessionCreatePage(initialCwd = defaultDeveloperPath()) {
  const nextCwd = initialCwd || defaultDeveloperPath();
  sessionCreateCwd = nextCwd;
  sessionBrowserCurrentPath = nextCwd || sessionBrowserCurrentPath || defaultDeveloperPath();
  sessionShowHidden = false;
  if (sessionHiddenToggle) sessionHiddenToggle.checked = false;
  renderSessionCreatePage();
  sessionCreatePage?.classList.remove("hidden");
  closeSidebar();
  closeSessionSwitcher();
  void loadSessionBrowser(sessionBrowserCurrentPath);
}

function closeSessionCreatePage() {
  sessionCreatePage?.classList.add("hidden");
}

function renderSessionCreatePage() {
  if (sessionSelectedCwd) {
    sessionSelectedCwd.innerHTML = sessionCreateCwd
      ? `
        <span class="session-card-main">
          <strong>${escapeHtml(basenameForPath(sessionCreateCwd))}</strong>
          <span>${escapeHtml(displayPath(sessionCreateCwd))}</span>
        </span>
        <span class="session-card-check" aria-hidden="true">✓</span>
      `
      : `
        <span class="session-card-main">
          <strong>フォルダを選択</strong>
          <span>下のブラウザから作業ディレクトリを選択</span>
        </span>
      `;
  }
  if (sessionStartButton) sessionStartButton.disabled = !sessionCreateCwd;
  renderSessionRecentList();
}

function renderSessionRecentList() {
  if (!sessionRecentList) return;
  sessionRecentList.replaceChildren();
  if (sessionRecentClear) sessionRecentClear.disabled = !cwdHistory.length;
  if (!cwdHistory.length) {
    const empty = document.createElement("div");
    empty.className = "session-empty";
    empty.innerHTML = "<strong>最近使ったプロジェクトはまだありません。</strong><span>下のフォルダブラウザから開始先を選ぶと、次回ここに表示されます。</span>";
    sessionRecentList.appendChild(empty);
    return;
  }
  for (const cwd of cwdHistory) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = cwd === sessionCreateCwd ? "session-card session-project-card active" : "session-card session-project-card";
    card.innerHTML = `
      <span class="session-card-icon" aria-hidden="true">${fontAwesomeIcon("folder", "project-icon")}</span>
      <span class="session-card-main">
        <span class="session-card-title">${escapeHtml(basenameForPath(cwd))}</span>
        <span class="session-card-path">${escapeHtml(displayPath(cwd))}</span>
        <span class="session-card-meta">最近使用</span>
      </span>
      ${cwd === sessionCreateCwd ? '<span class="session-card-check" aria-hidden="true">✓</span>' : ""}
    `;
    card.addEventListener("click", () => {
      sessionCreateCwd = cwd;
      sessionBrowserCurrentPath = cwd;
      renderSessionCreatePage();
      void loadSessionBrowser(cwd);
    });
    sessionRecentList.appendChild(card);
  }
}

function clearSessionRecentHistory() {
  cwdHistory = [];
  localStorage.removeItem(cwdHistoryStorageKey);
  localStorage.removeItem("codexRemoteLastCwd");
  renderSessionCreatePage();
}

function sessionDirectorySearchText() {
  return String(sessionDirectorySearch?.value || "").trim().toLowerCase();
}

function renderSessionBrowserEntries() {
  if (!sessionBrowserList) return;
  sessionBrowserList.replaceChildren();
  const searchText = sessionDirectorySearchText();
  const entries = searchText
    ? sessionBrowserEntries.filter((entry) => `${entry.name || ""} ${entry.path || ""}`.toLowerCase().includes(searchText))
    : sessionBrowserEntries;
  for (const entry of entries) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "session-card session-folder-card";
    row.innerHTML = `
      <span class="session-card-icon" aria-hidden="true">${fontAwesomeIcon("folder", "project-icon")}</span>
      <span class="session-card-main">
        <span class="session-card-title">${escapeHtml(entry.name)}</span>
        <span class="session-card-path">${escapeHtml(displayPath(entry.path))}</span>
      </span>
    `;
    row.addEventListener("click", () => loadSessionBrowser(entry.path));
    sessionBrowserList.appendChild(row);
  }
  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "session-empty";
    empty.textContent = searchText ? "一致するフォルダはありません。" : "下位フォルダはありません。";
    sessionBrowserList.appendChild(empty);
  }
}

async function loadSessionBrowser(pathValue = "", options = {}) {
  if (!sessionBrowserList || !sessionBrowserPath) return;
  if (!options.preserveSearch && sessionDirectorySearch) sessionDirectorySearch.value = "";
  sessionBrowserList.replaceChildren();
  const loading = document.createElement("div");
  loading.className = "session-empty";
  loading.textContent = "読み込み中...";
  sessionBrowserList.appendChild(loading);
  const query = new URLSearchParams();
  if (pathValue) query.set("path", pathValue);
  if (sessionShowHidden) query.set("hidden", "1");
  try {
    const suffix = query.toString() ? `?${query}` : "";
    const listing = await apiGet(`/api/fs/list${suffix}`);
    sessionBrowserCurrentPath = listing.path || "";
    sessionBrowserParentPath = listing.parent || "";
    sessionCreateCwd = listing.path || "";
    sessionBrowserPath.textContent = displayPath(listing.path) || "/";
    sessionBrowserPath.title = listing.path || "";
    sessionBrowserUp.disabled = !sessionBrowserParentPath;
    renderSessionCreatePage();
    sessionBrowserEntries = listing.entries || [];
    renderSessionBrowserEntries();
  } catch (error) {
    sessionBrowserEntries = [];
    sessionBrowserList.replaceChildren();
    const failed = document.createElement("div");
    failed.className = "session-empty error";
    failed.textContent = `読み込みに失敗しました: ${error.message}`;
    sessionBrowserList.appendChild(failed);
  }
}

function startSelectedSession() {
  if (!sessionCreateCwd) return;
  startNewThreadInCwd(sessionCreateCwd);
}

function showRightPanel({ focus = false } = {}) {
  document.body.classList.remove("hide-artifacts");
  document.body.classList.add("show-panel");
  closeSidebar();
  syncRightPanelState({ focus });
}

function closeRightPanel({ restoreFocus = false } = {}) {
  const wasOpen = !document.body.classList.contains("hide-artifacts") || document.body.classList.contains("show-panel");
  document.body.classList.add("hide-artifacts");
  document.body.classList.remove("show-panel");
  syncRightPanelState();
  if (restoreFocus && wasOpen) menuButton.focus();
}

function setActivePanel(panel) {
  activePanel = panel;
  for (const button of panelTabButtons) {
    const active = button.dataset.panelTab === panel;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  }
}

function clearPanel(title, panel = activePanel) {
  showRightPanel();
  setActivePanel(panel);
  artifactTitle.textContent = title;
  artifactList.classList.remove("artifact-browser-list");
  artifactList.replaceChildren();
  activeArtifactPath = "";
  artifactPreview.classList.add("hidden");
  artifactPreview.textContent = "";
}

function addPanelRow(text, detail, onClick, icon = "") {
  const row = document.createElement("button");
  row.type = "button";
  row.className = "artifact-row";
  row.classList.toggle("no-icon", !icon);
  const iconHtml = icon ? `<span class="panel-row-icon" aria-hidden="true">${escapeHtml(icon)}</span>` : "";
  const displayText = displayPath(text);
  const displayDetail = displayPath(detail);
  row.innerHTML = detail
    ? `${iconHtml}<span class="panel-row-copy"><strong>${escapeHtml(displayText)}</strong><small>${escapeHtml(displayDetail)}</small></span>`
    : `${iconHtml}<span class="panel-row-copy">${escapeHtml(displayText)}</span>`;
  if (displayText !== String(text || "")) row.title = String(text || "");
  if (displayDetail !== String(detail || "")) row.title = [row.title, String(detail || "")].filter(Boolean).join("\n");
  if (onClick) row.addEventListener("click", onClick);
  artifactList.appendChild(row);
  return row;
}

function appendToPrompt(text) {
  promptInput.value = `${promptInput.value}${promptInput.value ? "\n" : ""}${text}`;
  promptInput.focus();
}

async function copyTextToClipboard(text) {
  if (!String(text || "").trim()) return false;
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // ブラウザや権限状態で Clipboard API が拒否されるため、旧式コピーへ落とす。
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  let copied = false;
  try {
    copied = document.execCommand?.("copy") === true;
  } catch {
    copied = false;
  }
  textarea.remove();
  return copied;
}

function closeTerminalCopyFallback() {
  terminalCopyFallbackDialog?.remove();
  terminalCopyFallbackDialog = null;
}

function selectCopyFallbackText(textarea) {
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
  });
}

function showTerminalCopyFallback(text) {
  closeTerminalCopyFallback();

  const overlay = document.createElement("div");
  overlay.className = "terminal-copy-fallback";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "terminalCopyFallbackTitle");

  const card = document.createElement("div");
  card.className = "terminal-copy-card";

  const title = document.createElement("strong");
  title.id = "terminalCopyFallbackTitle";
  title.textContent = "コピー用テキスト";

  const description = document.createElement("p");
  description.textContent = "ブラウザが自動コピーを拒否しました。選択済みの内容をコピーしてください。";

  const textarea = document.createElement("textarea");
  textarea.className = "terminal-copy-textarea";
  textarea.readOnly = true;
  textarea.value = text;
  textarea.setAttribute("aria-label", "ターミナル表示のコピー用テキスト");

  const actions = document.createElement("div");
  actions.className = "terminal-confirm-actions";

  const retry = document.createElement("button");
  retry.type = "button";
  retry.textContent = "再コピー";
  retry.addEventListener("click", async () => {
    const copied = await copyTextToClipboard(text);
    if (copied) {
      closeTerminalCopyFallback();
      if (terminalStatus) terminalStatus.textContent = "ターミナル表示をコピーしました";
      addStatus("ターミナル表示をコピーしました。");
      return;
    }
    selectCopyFallbackText(textarea);
    if (terminalStatus) terminalStatus.textContent = "コピー用テキストを選択中";
  });

  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "閉じる";
  close.addEventListener("click", closeTerminalCopyFallback);

  actions.append(retry, close);
  card.append(title, description, textarea, actions);
  overlay.appendChild(card);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeTerminalCopyFallback();
  });
  document.body.appendChild(overlay);
  terminalCopyFallbackDialog = overlay;
  selectCopyFallbackText(textarea);
}

function renderArtifactIndex(items) {
  artifactItems = items;
  activeArtifactPath = "";
  setActivePanel("artifacts");
  artifactTitle.textContent = "アーティファクト";
  artifactList.classList.add("artifact-browser-list");
  renderArtifactRows();
  hideArtifactPreview();
}

function renderArtifactRows() {
  artifactList.replaceChildren();
  for (const item of artifactItems) {
    const icon = item.kind === "image" ? "IMG" : item.kind === "markdown" ? "MD" : "FILE";
    const label = item.name || item.path?.split(/[\\/]/).filter(Boolean).pop() || "artifact";
    const row = addPanelRow(label, item.path || "", () => showArtifact(item.path), icon);
    row.classList.toggle("active", item.path === activeArtifactPath);
  }
  if (!artifactItems.length) addPanelRow("アーティファクトは見つかりませんでした");
}

function hideArtifactPreview() {
  activeArtifactPath = "";
  renderArtifactRows();
  artifactPreview.className = "artifact-preview hidden";
  artifactPreview.textContent = "";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[char];
  });
}

function showToolError(name, error) {
  clearPanel(name);
  addPanelRow("読み込みに失敗しました", error.message);
  addEntry("error", `${name}: ${error.message}`);
  document.body.classList.remove("show-sidebar");
}

function maybeNotifyTurnCompleted() {
  if (!notificationsEnabled || !document.hidden || !("Notification" in window) || Notification.permission !== "granted") return;
  const title = threadTitle?.textContent || "Codex Remote";
  new Notification("Codex turn completed", {
    body: title,
    tag: selectedThread || "codex-remote-turn",
  });
}

function shouldHandleTurnCompleted() {
  const now = Date.now();
  if (now - lastTurnCompletedAt < 1200) return false;
  lastTurnCompletedAt = now;
  return true;
}

async function toggleBrowserNotifications(enabled) {
  notificationsEnabled = Boolean(enabled);
  if (notificationsEnabled && "Notification" in window && Notification.permission === "default") {
    const permission = await Notification.requestPermission();
    notificationsEnabled = permission === "granted";
  }
  if (notificationsEnabled && "Notification" in window && Notification.permission === "denied") notificationsEnabled = false;
  localStorage.setItem("codexRemoteNotificationsEnabled", notificationsEnabled ? "1" : "0");
  showSettings();
}

async function showPlugins() {
  clearPanel("プラグイン");
  addPanelRow("読み込み中...");
  try {
    const result = await apiGet("/api/plugins");
    const marketplaces = result.marketplaces || result.data || [];
    artifactList.replaceChildren();
    for (const marketplace of marketplaces) {
      const plugins = marketplace.plugins || marketplace.entries || [];
      if (!plugins.length) addPanelRow(marketplace.name || marketplace.id || "marketplace", "プラグインなし");
      for (const plugin of plugins) {
        const summary = plugin.summary || plugin;
        addPanelRow(summary.name || summary.id, summary.enabled ? "enabled" : summary.installed ? "installed" : "available");
      }
    }
    if (!artifactList.children.length) addPanelRow("プラグインは見つかりませんでした");
  } catch (error) {
    showToolError("プラグイン", error);
  }
}

async function showAutomations() {
  clearPanel("オートメーション");
  addPanelRow("読み込み中...");
  try {
    const result = await apiGet("/api/automations");
    artifactList.replaceChildren();
    for (const automation of result.data || []) addPanelRow(automation.name, automation.status);
    if (!artifactList.children.length) addPanelRow("登録済みオートメーションはありません");
  } catch (error) {
    showToolError("オートメーション", error);
  }
}

async function showSkills() {
  clearPanel("スキル", "sources");
  addPanelRow("読み込み中...");
  try {
    const result = await apiGet("/api/skills");
    artifactList.replaceChildren();
    for (const skill of result.data || []) {
      addPanelRow(skill.name, skill.description || skill.source || "", () => {
        appendToPrompt(`$${skill.name}\n\nこのスキルの手順に従って進めて。`);
        addStatus(`$${skill.name} をチャット入力へ追加しました。`);
      }, "SK");
    }
    if (!artifactList.children.length) addPanelRow("利用可能なスキルは見つかりませんでした");
  } catch (error) {
    showToolError("スキル", error);
  }
}

async function showFolderBrowser(pathValue = "", showHidden = false) {
  clearPanel("フォルダ", "workspace");
  addPanelRow("読み込み中...");
  const query = new URLSearchParams();
  if (pathValue) query.set("path", pathValue);
  if (showHidden) query.set("hidden", "1");
  try {
    const suffix = query.toString() ? `?${query}` : "";
    const listing = await apiGet(`/api/fs/list${suffix}`);
    artifactList.replaceChildren();
    artifactList.classList.add("artifact-browser-list");
    addPanelRow("このフォルダで新しいチャット", listing.path, () => startNewThreadInCwd(listing.path), "NEW");
    addPanelRow(showHidden ? "隠しフォルダを非表示" : "隠しフォルダを表示", listing.path, () => showFolderBrowser(listing.path, !showHidden), "VIS");
    if (listing.parent) addPanelRow("親フォルダへ", listing.parent, () => showFolderBrowser(listing.parent, showHidden), "UP");
    for (const entry of listing.entries || []) {
      addPanelRow(entry.name, entry.path, () => showFolderBrowser(entry.path, showHidden), "DIR");
    }
    if (!listing.entries?.length) addPanelRow("下位フォルダはありません", listing.path);
  } catch (error) {
    showToolError("フォルダ", error);
  }
}

async function showSettings() {
  const renderSeq = ++settingsRenderSeq;
  clearPanel("設定");
  artifactList.replaceChildren();
  renderThemeSettings();
  const notificationDetail =
    "Notification" in window
      ? notificationsEnabled
        ? `有効 / permission: ${Notification.permission}`
        : `無効 / permission: ${Notification.permission}`
      : "このブラウザでは未対応";
  addPanelRow(notificationsEnabled ? "完了通知を無効化" : "完了通知を有効化", notificationDetail, () => {
    void toggleBrowserNotifications(!notificationsEnabled);
  }, "NTF");
  const loadingRow = addPanelRow("読み込み中...");
  try {
    const result = await apiGet("/api/config");
    if (renderSeq !== settingsRenderSeq) return;
    loadingRow.remove();
    const config = result.config?.config || {};
    addPanelRow("認証", result.auth?.authMethod || "unknown");
    addPanelRow("既定モデル", config.model || selectedModel || "unknown");
    addPanelRow("承認", accessMode.approvalPolicy);
    addPanelRow("サンドボックス", accessMode.sandboxMode);
    addPanelRow("作業ディレクトリ", config.cwd || "");
    if (result.errors?.length) addPanelRow("補足エラー", result.errors.join(" / "));
  } catch (error) {
    if (renderSeq !== settingsRenderSeq) return;
    loadingRow.remove();
    addPanelRow("読み込みに失敗しました", error.message);
    addEntry("error", `設定: ${error.message}`);
  }
}

function renderThemeSettings() {
  const group = document.createElement("section");
  group.className = "theme-settings";

  const title = document.createElement("div");
  title.className = "theme-settings-title";
  title.textContent = "カラーテーマ";
  group.appendChild(title);

  const options = document.createElement("div");
  options.className = "theme-options";
  for (const theme of themeOptions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = selectedTheme === theme.id ? "theme-option active" : "theme-option";
    button.dataset.themeChoice = theme.id;
    button.innerHTML = `
      <span class="theme-swatch" aria-hidden="true"><span></span><span></span><span></span></span>
      <strong>${escapeHtml(theme.name)}</strong>
      <small>${escapeHtml(theme.detail)}</small>
    `;
    button.addEventListener("click", () => {
      applyTheme(theme.id);
      addStatus(`テーマを ${theme.name} に切り替えました。`);
      showSettings();
    });
    options.appendChild(button);
  }
  group.appendChild(options);
  artifactList.appendChild(group);
}

async function showModels() {
  clearPanel("モデル");
  addPanelRow("読み込み中...");
  try {
    const result = await apiGet("/api/models");
    artifactList.replaceChildren();
    const models = result.data || [];
    for (const candidate of models.slice(0, 24)) {
      addPanelRow(candidate.displayName || candidate.model || candidate.id, candidate.defaultReasoningEffort || "", () => {
        selectedModel = candidate.model || candidate.id;
        selectedModelLabel = (candidate.displayName || selectedModel).replace(/^GPT-/, "").replace(/^gpt-/, "");
        localStorage.setItem("codexPhoneModel", selectedModel);
        localStorage.setItem("codexPhoneModelLabel", selectedModelLabel);
        updateModelButton();
        addStatus(`モデルを ${selectedModel} に設定しました。次の送信から反映します。`);
      });
    }
    if (!models.length) addPanelRow("モデル一覧を取得できませんでした");
  } catch (error) {
    showToolError("モデル", error);
  }
}

function renderWorkspaceEntries(entries) {
  artifactList.replaceChildren();
  artifactList.classList.add("artifact-browser-list");
  for (const entry of entries) {
    const icon = entry.type === "directory" ? "DIR" : entry.kind === "image" ? "IMG" : entry.kind === "markdown" ? "MD" : "FILE";
    const row = addPanelRow(entry.name || entry.path, entry.path, null, icon);
    row.classList.add("workspace-row");
    if (entry.type === "directory") {
      row.disabled = true;
      continue;
    }
    row.innerHTML += `
      <span class="row-actions" aria-hidden="true">
        <span>追加</span>
      </span>
    `;
    let clickTimer = null;
    row.addEventListener("click", (event) => {
      if (event.altKey || event.metaKey) {
        showArtifact(entry.path);
        return;
      }
      if (event.detail > 1) return;
      clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {
        appendToPrompt(`@${entry.path}`);
        addStatus(`${entry.path} をチャット入力へ追加しました。`);
      }, 220);
    });
    row.addEventListener("dblclick", () => {
      clearTimeout(clickTimer);
      showArtifact(entry.path);
    });
  }
  if (!entries.length) addPanelRow("ワークスペース内のファイルは見つかりませんでした", "検索条件を変えるか、リポジトリを確認してください");
}

async function showWorkspace() {
  clearPanel("ワークスペース", "workspace");
  addPanelRow("読み込み中...");
  try {
    const result = await apiGet("/api/workspace?limit=180");
    renderWorkspaceEntries(result.data || []);
  } catch (error) {
    showToolError("ワークスペース", error);
  }
}

function renderReview(result) {
  artifactList.replaceChildren();
  artifactList.classList.add("artifact-browser-list");
  addPanelRow("ブランチ", result.branch || "unknown", null, "G");
  addPanelRow(result.clean ? "変更なし" : `${result.files?.length || 0}件の変更`, result.clean ? "working tree clean" : "git status --short", null, "Δ");
  for (const statLine of result.stat || []) addPanelRow(statLine.trim(), "", null, "Σ");
  for (const file of result.files || []) {
    const details = document.createElement("details");
    details.className = "review-file";
    const summary = document.createElement("summary");
    summary.innerHTML = `
      <span class="review-file-status">${escapeHtml(file.status || "MOD")}</span>
      <span class="review-file-path">${escapeHtml(file.path)}</span>
      <span class="row-diff-stat">${diffStatLabel(file)}</span>
    `;
    const actions = document.createElement("div");
    actions.className = "review-file-actions";
    const action = document.createElement("button");
    action.type = "button";
    action.textContent = file.openable ? "Open" : "Prompt";
    action.addEventListener("click", () => {
      if (file.openable) {
        showArtifact(file.path);
        return;
      }
      appendToPrompt(`レビュー対象: ${file.path}`);
      addStatus(`${file.path} をレビュー対象として入力に追加しました。`);
    });
    actions.appendChild(action);
    const pre = document.createElement("pre");
    pre.className = "review-diff";
    for (const line of String(file.diff || "diffなし").split("\n")) {
      const span = document.createElement("span");
      span.className = line.startsWith("+") && !line.startsWith("+++") ? "line-add" : line.startsWith("-") && !line.startsWith("---") ? "line-del" : "";
      span.textContent = line || " ";
      pre.appendChild(span);
    }
    details.append(summary, actions, pre);
    artifactList.appendChild(details);
  }
}

async function showReview() {
  clearPanel("レビュー", "review");
  addPanelRow("読み込み中...");
  try {
    const result = await apiGet("/api/review");
    renderReview(result);
  } catch (error) {
    showToolError("レビュー", error);
  }
}

function normalizeGoalForDisplay(goal) {
  if (!goal) return null;
  if (typeof goal === "string") return goal.trim() ? { objective: goal.trim() } : null;
  if (typeof goal !== "object") return null;
  const objective = goal.objective ?? goal.goal ?? goal.text ?? goal.description ?? "";
  const tokensUsed = goal.tokensUsed ?? goal.tokens_used;
  const timeUsedSeconds = goal.timeUsedSeconds ?? goal.time_used_seconds;
  return {
    ...goal,
    objective: String(objective || ""),
    tokensUsed,
    timeUsedSeconds,
  };
}

function syncGoalIndicator(goal = currentGoal) {
  if (!goalStatusPill) return;
  const normalized = normalizeGoalForDisplay(goal);
  const hasGoal = Boolean(normalized?.objective || normalized?.status);
  goalStatusPill.classList.toggle("hidden", !hasGoal);
  goalStatusPill.setAttribute("aria-label", hasGoal ? "Goal 設定済み" : "Goal 未設定");
  goalStatusPill.title = hasGoal ? "Goal 設定済み" : "";
}

function formatGoalNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return number.toLocaleString("ja-JP");
}

function formatGoalDuration(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) return "";
  if (seconds < 60) return `${Math.floor(seconds)}秒`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes ? `${hours}時間${restMinutes}分` : `${hours}時間`;
}

function formatGoalUpdatedAt(value) {
  if (!value) return "";
  const raw = typeof value === "number" && value < 10_000_000_000 ? value * 1000 : value;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function createGoalSettingPrompt(objective) {
  return `このスレッドのゴールを次に設定して: ${objective}`;
}

function sendGoalSettingPrompt(objective, { sendNow = true } = {}) {
  const text = String(objective || "").trim();
  if (!text) {
    addStatus("Goal 内容を入力してください。");
    return;
  }
  const promptText = createGoalSettingPrompt(text);
  setMainMode("chat");
  if (sendNow && sendPromptToBridge(promptText, [])) {
    addStatus("Goal 設定プロンプトを送信しました。");
    return;
  }
  appendToPrompt(promptText);
  addStatus("Goal 設定プロンプトを入力欄に追加しました。");
}

function renderGoalView(goal = currentGoal) {
  const normalized = normalizeGoalForDisplay(goal);
  currentGoal = normalized;
  syncGoalIndicator(currentGoal);
  artifactList.replaceChildren();
  artifactList.classList.add("artifact-browser-list");
  const wrap = document.createElement("div");
  wrap.className = "goal-editor";
  const status = normalized?.status || "";
  const tokensUsed = formatGoalNumber(normalized?.tokensUsed);
  const timeUsed = formatGoalDuration(normalized?.timeUsedSeconds);
  const updatedAt = formatGoalUpdatedAt(normalized?.updatedAt || normalized?.updated_at);
  const detailRows = [
    ["Status", status],
    ["Tokens", tokensUsed],
    ["Time", timeUsed],
    ["Updated", updatedAt],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `<span><b>${escapeHtml(label)}</b>${escapeHtml(value)}</span>`)
    .join("");
  const objective = normalized?.objective || "";
  wrap.innerHTML = `
    <section class="goal-card ${normalized ? "" : "is-empty"}">
      <span class="goal-kicker">${normalized ? "現在の Goal" : "未設定"}</span>
      <strong>${escapeHtml(objective || "このスレッドにはまだ goal がありません")}</strong>
      ${detailRows ? `<div class="goal-meta">${detailRows}</div>` : ""}
    </section>
    <label class="goal-field">
      <span>${normalized ? "Goal を更新" : "Goal を設定"}</span>
      <textarea id="goalPromptText" rows="5" placeholder="この thread の goal を入力">${escapeHtml(objective)}</textarea>
    </label>
    <div class="goal-actions">
      <button type="button" class="secondary" id="goalPromptAppendButton">入力欄へ追加</button>
      <button type="button" id="goalPromptSendButton">設定プロンプトを送信</button>
    </div>
  `;
  artifactList.appendChild(wrap);
  const textarea = wrap.querySelector("#goalPromptText");
  wrap.querySelector("#goalPromptSendButton")?.addEventListener("click", () => {
    sendGoalSettingPrompt(textarea.value, { sendNow: true });
  });
  wrap.querySelector("#goalPromptAppendButton")?.addEventListener("click", () => {
    sendGoalSettingPrompt(textarea.value, { sendNow: false });
  });
}

async function showGoal() {
  clearPanel("Goal", "goal");
  if (!selectedThread) {
    addPanelRow("thread未選択", "履歴または稼働中 thread を選択してください", null, "GOAL");
    return;
  }
  addPanelRow("読み込み中...");
  try {
    const result = await apiGet(`/api/goal?thread=${encodeURIComponent(selectedThread)}`);
    renderGoalView(result.goal || null);
  } catch (error) {
    showToolError("Goal", error);
  }
}

async function archiveThreads(threadIds, archived) {
  for (const threadId of threadIds) {
    await apiPost("/api/thread-archive", { thread: threadId, archived });
  }
  archiveSelection = new Set();
  await loadThreads({ background: true });
  await showArchive();
}

async function renameThread(thread) {
  const nextName = window.prompt("Thread name", thread.name || titleForThread(thread));
  if (nextName === null) return;
  await apiPost("/api/thread-name", { thread: thread.id, name: nextName });
  await loadThreads({ background: true });
  await showArchive();
}

function renderArchiveThreads(threads, archivedView) {
  artifactList.replaceChildren();
  artifactList.classList.add("artifact-browser-list");
  const toolbar = document.createElement("div");
  toolbar.className = "archive-toolbar";
  const selected = () => Array.from(archiveSelection);
  const archiveButton = document.createElement("button");
  archiveButton.type = "button";
  archiveButton.textContent = archivedView ? "選択を戻す" : "選択をアーカイブ";
  archiveButton.disabled = archiveSelection.size === 0;
  archiveButton.addEventListener("click", () => void archiveThreads(selected(), !archivedView));
  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.disabled = true;
  deleteButton.textContent = "削除は未対応";
  toolbar.append(archiveButton, deleteButton);
  artifactList.appendChild(toolbar);

  for (const thread of threads) {
    const row = document.createElement("div");
    row.className = "archive-thread-row";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = archiveSelection.has(thread.id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) archiveSelection.add(thread.id);
      else archiveSelection.delete(thread.id);
      renderArchiveThreads(threads, archivedView);
    });
    const open = document.createElement("button");
    open.type = "button";
    open.className = "archive-thread-main";
    open.innerHTML = `<strong>${escapeHtml(titleForThread(thread))}</strong><small>${escapeHtml(displayPath(thread.cwd || ""))}</small>`;
    open.addEventListener("click", () => {
      if (!archivedView) selectThread(thread.id);
    });
    const rename = document.createElement("button");
    rename.type = "button";
    rename.textContent = "Rename";
    rename.addEventListener("click", () => void renameThread(thread));
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.textContent = archivedView ? "Unarchive" : "Archive";
    toggle.addEventListener("click", () => void archiveThreads([thread.id], !archivedView));
    row.append(checkbox, open, rename, toggle);
    artifactList.appendChild(row);
  }
  if (!threads.length) addPanelRow(archivedView ? "アーカイブ済み thread はありません" : "履歴 thread はありません");
}

async function showArchive(archivedView = true) {
  clearPanel(archivedView ? "Archive" : "Threads", "archive");
  addPanelRow("読み込み中...");
  try {
    const result = await apiGet(`/api/threads?limit=100&archived=${archivedView ? "1" : "0"}`);
    renderArchiveThreads(result.data || [], archivedView);
  } catch (error) {
    showToolError("Archive", error);
  }
}

function showSources() {
  clearPanel("情報源", "sources");
  addPanelRow("Web調査を入力へ追加", "外部確認が必要なターンで使う", () => {
    appendToPrompt("Web調査を使って確認してください。");
    addStatus("Web調査指示をチャット入力へ追加しました。");
  }, "WEB");
  addPanelRow("スキル", "利用可能な skill を入力へ追加", showSkills, "SK");
  addPanelRow("ローカルファイル", "Filesタブから @path を追加できます", showWorkspace, "FILE");
  addPanelRow("フォルダを選んで新しいチャット", "home 配下のフォルダだけ表示", () => showFolderBrowser(currentWorkdir), "DIR");
  addPanelRow("差分レビュー", "Diffタブから変更ファイルを追加できます", showReview, "DIFF");
}

function startVoiceInput() {
  voiceButton.dataset.voiceState = "requested";
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    voiceButton.dataset.voiceState = "unsupported";
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    addStatus(isIos ? "iOS Safari では Web Speech API が利用できない場合があります。キーボードの音声入力を使ってください。" : "このブラウザでは音声入力APIが使えません。");
    promptInput.focus();
    return;
  }
  const recognition = new SpeechRecognition();
  recognition.lang = document.documentElement.lang || "ja-JP";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  voiceButton.classList.add("listening");
  addStatus("音声入力を開始しました。ブラウザのマイク許可を確認してください。");
  recognition.addEventListener("result", (event) => {
    const transcript = event.results?.[0]?.[0]?.transcript || "";
    if (!transcript) return;
    promptInput.value = `${promptInput.value}${promptInput.value ? "\n" : ""}${transcript}`;
    promptInput.focus();
    addStatus("音声入力をテキストへ追加しました。");
  });
  recognition.addEventListener("error", (event) => addStatus(`音声入力に失敗しました: ${event.error || "ブラウザまたは権限が音声入力を拒否しました"}`));
  recognition.addEventListener("end", () => voiceButton.classList.remove("listening"));
  recognition.start();
}

async function showStatus() {
  clearPanel("バックグラウンド", "status");
  try {
    const result = await apiGet("/api/status");
    addPanelRow("UI port", String(result.uiPort));
    addPanelRow("Codex app-server", result.codexUrl);
    addPanelRow("履歴同期", result.historySyncEnabled ? "有効" : "無効");
    addPanelRow("作業ディレクトリ", result.workdir);
    for (const bridge of result.bridges || []) {
      addPanelRow(bridge.threadId || "thread準備中", `${bridge.clients}端末 / ${bridge.ready ? "ready" : "starting"}`);
    }
  } catch (error) {
    showToolError("バックグラウンド", error);
  }
}

async function showArtifact(path) {
  showRightPanel();
  setActivePanel("artifacts");
  artifactTitle.textContent = "アーティファクト";
  artifactList.classList.add("artifact-browser-list");
  activeArtifactPath = path;
  renderArtifactRows();
  artifactPreview.className = "artifact-preview";
  artifactPreview.innerHTML = `
    <div class="artifact-preview-header">
      <div class="artifact-preview-title">${escapeHtml(path)}</div>
      <button type="button" class="artifact-preview-close" data-preview-close>閉じる</button>
    </div>
    <p>読み込み中...</p>
  `;
  try {
    const result = await apiGet(`/api/file?path=${encodeURIComponent(path)}`);
    setArtifactPreview(result);
    artifactPreview.classList.remove("hidden");
  } catch (error) {
    artifactPreview.innerHTML = `
      <div class="artifact-preview-header">
        <div class="artifact-preview-title">${escapeHtml(path)}</div>
        <button type="button" class="artifact-preview-close" data-preview-close>閉じる</button>
      </div>
      <p>読み込みに失敗しました: ${escapeHtml(error.message)}</p>
    `;
    addEntry("error", `アーティファクト: ${error.message}`);
  }
}

function setArtifactPreview(result) {
  const isImage = result.kind === "image";
  const isMarkdown = result.kind === "markdown" || /\.md(?:own)?$/i.test(result.path);
  artifactPreview.classList.toggle("image-artifact-preview", isImage);
  artifactPreview.classList.toggle("markdown-preview", isMarkdown);
  artifactPreview.classList.toggle("plain-preview", !isMarkdown && !isImage);
  const header = `
    <div class="artifact-preview-header">
      <div class="artifact-preview-title">${escapeHtml(result.path)}</div>
      <button type="button" class="artifact-preview-close" data-preview-close>閉じる</button>
    </div>
  `;
  if (isImage) {
    artifactPreview.innerHTML = header;
    const gallery = renderImageGallery([{ name: result.path, url: result.imageUrl }]);
    artifactPreview.appendChild(gallery);
    return;
  }
  artifactPreview.innerHTML = `${header}${
    isMarkdown ? renderMarkdown(result.text, { allowHtml: true, headingOffset: 0 }) : `<pre><code>${escapeHtml(result.text)}</code></pre>`
  }`;
}

function renderAttachments() {
  attachments.replaceChildren();
  attachments.classList.toggle("has-attachments", pendingFiles.length > 0);
  for (const file of pendingFiles) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "attachment-chip";
    chip.setAttribute("aria-label", `${file.name} の添付を削除`);
    const thumb = document.createElement("img");
    thumb.src = file.dataUrl;
    thumb.alt = "";
    const label = document.createElement("span");
    label.textContent = file.name;
    const close = document.createElement("span");
    close.textContent = "×";
    chip.append(thumb, label, close);
    chip.addEventListener("click", () => {
      pendingFiles = pendingFiles.filter((candidate) => candidate !== file);
      renderAttachments();
    });
    attachments.appendChild(chip);
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type, dataUrl: reader.result });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setPanelWidth(kind, width) {
  const config = panelWidthConfig[kind];
  if (!config) return width;
  const next = clampNumber(width, config.min, config.max);
  const rootStyle = document.documentElement.style;
  const handle = kind === "left" ? leftResizeHandle : rightResizeHandle;
  rootStyle.setProperty(config.cssVar, `${next}px`);
  localStorage.setItem(config.storageKey, String(next));
  handle?.setAttribute("aria-valuenow", String(next));
  return next;
}

function loadPanelWidths() {
  for (const kind of ["left", "right"]) {
    const config = panelWidthConfig[kind];
    const handle = kind === "left" ? leftResizeHandle : rightResizeHandle;
    const savedWidth = Number(localStorage.getItem(config.storageKey));
    if (savedWidth) setPanelWidth(kind, savedWidth);
    handle?.setAttribute("aria-valuemin", String(config.min));
    handle?.setAttribute("aria-valuemax", String(config.max));
  }
}

function bindResizeHandle(handle, kind) {
  if (!handle) return;
  let drag = null;
  const currentWidth = () => {
    const value =
      kind === "left"
        ? getComputedStyle(document.documentElement).getPropertyValue(panelWidthConfig.left.cssVar)
        : getComputedStyle(document.documentElement).getPropertyValue(panelWidthConfig.right.cssVar);
    return Number.parseFloat(value) || panelWidthConfig[kind].fallback;
  };

  handle.addEventListener("pointerdown", (event) => {
    if (window.matchMedia("(max-width: 820px)").matches) return;
    event.preventDefault();
    drag = { pointerId: event.pointerId, startX: event.clientX, startWidth: currentWidth() };
    handle.setPointerCapture(event.pointerId);
    document.body.classList.add("resizing-sidebar");
  });

  handle.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const delta = event.clientX - drag.startX;
    setPanelWidth(kind, kind === "left" ? drag.startWidth + delta : drag.startWidth - delta);
  });

  const finish = (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag = null;
    document.body.classList.remove("resizing-sidebar");
  };
  handle.addEventListener("pointerup", finish);
  handle.addEventListener("pointercancel", finish);
  handle.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? 32 : 12;
    if (event.key === "Home") setPanelWidth(kind, panelWidthConfig[kind].min);
    else if (event.key === "End") setPanelWidth(kind, panelWidthConfig[kind].max);
    else {
      const direction = event.key === "ArrowRight" ? 1 : -1;
      setPanelWidth(kind, currentWidth() + (kind === "left" ? direction : -direction) * step);
    }
  });
}

function bindSessionSwipe() {
  const surface = document.querySelector(".mode-stage");
  if (!surface) return;
  let gesture = null;
  let wheelGesture = { accumX: 0, lastWheelAt: 0, lastSwitchAt: 0, switched: false };
  const touchActivatePx = 18;
  const touchDistanceRatio = 0.16;
  const touchVelocityPxPerMs = 0.32;
  const wheelResetMs = 180;
  const wheelCooldownMs = 350;
  const wheelMinThresholdPx = 42;
  const wheelMaxThresholdPx = 110;
  const wheelThresholdRatio = 0.12;
  const isOverlayOpen = () =>
    sessionCreatePage?.classList.contains("hidden") === false ||
    sessionSwitcherOverlay?.classList.contains("hidden") === false;
  const isControlTarget = (target) => {
    if (!target?.closest) return false;
    if (target.closest("#terminalHost")) return false;
    return Boolean(
      target.closest(
        "input, textarea, select, button, a, [contenteditable='true'], #composer, #terminalInputArea, .terminal-toolbar, .approval",
      ),
    );
  };
  const isSwipeBlocked = (event) => terminalLongPressActive || isOverlayOpen() || isControlTarget(event?.target);
  surface.addEventListener("touchstart", (event) => {
    if (event.touches.length !== 1 || isSwipeBlocked(event)) return;
    const touch = event.touches[0];
    gesture = { x: touch.clientX, y: touch.clientY, time: Date.now(), active: false };
  }, { passive: true });
  surface.addEventListener("touchmove", (event) => {
    if (!gesture || event.touches.length !== 1) return;
    if (terminalLongPressActive) {
      gesture = null;
      return;
    }
    const touch = event.touches[0];
    const dx = touch.clientX - gesture.x;
    const dy = touch.clientY - gesture.y;
    if (!gesture.active && Math.abs(dx) > touchActivatePx && Math.abs(dx) > Math.abs(dy) * 1.25) gesture.active = true;
    if (gesture.active) event.preventDefault();
  }, { passive: false });
  const finish = (event) => {
    if (!gesture) return;
    const touch = event.changedTouches?.[0];
    const dx = touch ? touch.clientX - gesture.x : 0;
    const elapsed = Math.max(1, Date.now() - gesture.time);
    const velocity = Math.abs(dx) / elapsed;
    const shouldSwitch = gesture.active && (Math.abs(dx) > surface.clientWidth * touchDistanceRatio || velocity > touchVelocityPxPerMs);
    if (shouldSwitch) switchOpenSessionByOffset(dx < 0 ? 1 : -1);
    gesture = null;
  };
  surface.addEventListener("touchend", finish, { passive: true });
  surface.addEventListener("touchcancel", () => {
    gesture = null;
  }, { passive: true });
  surface.addEventListener("wheel", (event) => {
    if (isSwipeBlocked(event)) return;
    if (Math.abs(event.deltaX) < Math.abs(event.deltaY) * 1.1) return;
    event.preventDefault();
    const now = Date.now();
    if (now - wheelGesture.lastWheelAt > wheelResetMs) {
      wheelGesture = { accumX: 0, lastWheelAt: 0, lastSwitchAt: wheelGesture.lastSwitchAt, switched: false };
    }
    wheelGesture.lastWheelAt = now;
    wheelGesture.accumX += event.deltaX;
    if (wheelGesture.switched) return;
    if (now - wheelGesture.lastSwitchAt < wheelCooldownMs) return;
    const threshold = Math.max(
      wheelMinThresholdPx,
      Math.min(wheelMaxThresholdPx, surface.clientWidth * wheelThresholdRatio),
    );
    if (Math.abs(wheelGesture.accumX) < threshold) return;
    const switched = switchOpenSessionByOffset(wheelGesture.accumX > 0 ? 1 : -1);
    wheelGesture = { accumX: 0, lastWheelAt: now, lastSwitchAt: switched ? now : wheelGesture.lastSwitchAt, switched };
  }, { passive: false });
}

function sendPromptToBridge(text, attachments = []) {
  const trimmed = String(text || "").trim();
  if ((!trimmed && !attachments.length) || !ws || ws.readyState !== WebSocket.OPEN) return false;
  ws.send(
    JSON.stringify({
      type: "prompt",
      token,
      text: trimmed || "添付画像を確認してください。",
      attachments,
      options: {
        model: selectedModel || undefined,
        approvalPolicy: accessMode.approvalPolicy,
        sandboxMode: accessMode.sandboxMode,
      },
    }),
  );
  return true;
}

function sendApprovalToBridge(decision) {
  if (!pendingApproval) return false;
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    approval.classList.remove("hidden");
    setRunState("disconnected", "承認待ち・再接続が必要");
    addStatus("接続が切れているため承認を送れません。再接続後にもう一度承認できます。");
    connect();
    return false;
  }
  ws.send(JSON.stringify({ type: "approval", token, decision, request: pendingApproval }));
  approval.classList.add("hidden");
  pendingApproval = null;
  setRunState("running", decision === "accept" ? "承認済み・処理中" : "拒否済み・処理中");
  return true;
}

function slashCommands() {
  return Array.isArray(composerCommandRuntime.SLASH_COMMANDS) ? composerCommandRuntime.SLASH_COMMANDS : [];
}

function classifyComposerSubmit(text) {
  if (typeof composerCommandRuntime.classifyComposerSubmit === "function") {
    return composerCommandRuntime.classifyComposerSubmit(text, slashCommands());
  }
  const trimmed = String(text || "").trim();
  if (!trimmed) return { kind: "empty" };
  const leadingTrimmed = String(text || "").trimStart();
  if (leadingTrimmed.startsWith("$")) {
    const command = leadingTrimmed.slice(1).trim();
    return command ? { kind: "shell", command } : { kind: "empty-shell" };
  }
  return { kind: "chat", text: trimmed };
}

function getComposerSlashState() {
  if (typeof composerCommandRuntime.getComposerCommandState !== "function") return { kind: "none" };
  return composerCommandRuntime.getComposerCommandState(
    promptInput.value,
    promptInput.selectionStart ?? promptInput.value.length,
    slashCommands(),
  );
}

function hideSlashCommandMenu() {
  slashMenuState = { ...slashMenuState, open: false, candidates: [] };
  slashCommandMenu?.classList.add("hidden");
  slashCommandMenu?.replaceChildren();
}

function renderSlashCommandMenu(state) {
  if (!slashCommandMenu) return;
  if (state.kind !== "slash" || !state.candidates.length) {
    hideSlashCommandMenu();
    return;
  }
  slashMenuState = {
    open: true,
    candidates: state.candidates,
    selectedIndex: Math.min(slashMenuState.selectedIndex, state.candidates.length - 1),
    replaceStart: state.replaceStart,
    replaceEnd: state.replaceEnd,
  };
  slashCommandMenu.replaceChildren();
  for (const [index, command] of state.candidates.entries()) {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "slash-command-option";
    option.classList.toggle("selected", index === slashMenuState.selectedIndex);
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", String(index === slashMenuState.selectedIndex));
    option.dataset.index = String(index);
    option.innerHTML = `
      <span class="slash-command-main">${escapeHtml(command.label || command.value)}</span>
      <span class="slash-command-detail">${escapeHtml(command.description || "")}</span>
    `;
    option.addEventListener("mousedown", (event) => event.preventDefault());
    option.addEventListener("click", () => executeSlashCommand(command, { fromMenu: true }));
    slashCommandMenu.appendChild(option);
  }
  slashCommandMenu.classList.remove("hidden");
}

function updateSlashSelection(index) {
  if (!slashMenuState.open || !slashMenuState.candidates.length) return;
  const total = slashMenuState.candidates.length;
  slashMenuState.selectedIndex = ((index % total) + total) % total;
  for (const [buttonIndex, button] of Array.from(slashCommandMenu?.children || []).entries()) {
    const selected = buttonIndex === slashMenuState.selectedIndex;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-selected", String(selected));
  }
}

function insertSlashCommand(command, menuState = slashMenuState) {
  const value = `${command.value || `/${command.id || ""}`} `;
  const start = menuState.open ? menuState.replaceStart : 0;
  const end = menuState.open ? menuState.replaceEnd : promptInput.value.length;
  promptInput.value = `${promptInput.value.slice(0, start)}${value}${promptInput.value.slice(end)}`;
  const cursor = start + value.length;
  promptInput.setSelectionRange(cursor, cursor);
  promptInput.focus();
  updateComposerCommandUi();
}

function executeSlashCommand(command, { fromMenu = false } = {}) {
  const previousMenuState = { ...slashMenuState };
  hideSlashCommandMenu();
  const action = command?.action || "insert";
  if (action === "new-thread") {
    promptInput.value = "";
    openSessionCreatePage();
    return;
  }
  if (action === "review") {
    promptInput.value = "";
    showReview();
    return;
  }
  if (action === "status") {
    promptInput.value = "";
    showStatus();
    return;
  }
  if (action === "model") {
    promptInput.value = "";
    toggleModelMenu();
    modelButton.focus();
    return;
  }
  if (action === "goal") {
    promptInput.value = "";
    showGoal();
    return;
  }
  if (fromMenu) insertSlashCommand(command, previousMenuState);
  else addStatus(`${command?.value || "/"} は入力欄へ挿入してから編集してください。`);
}

function updateComposerCommandUi() {
  const submitState = classifyComposerSubmit(promptInput.value);
  const isShellCommand = submitState.kind === "shell";
  composer.classList.toggle("shell-command-active", isShellCommand);
  if (composerCommandHint) {
    composerCommandHint.textContent = isShellCommand ? `ターミナルで実行: ${submitState.command}` : "";
    composerCommandHint.classList.toggle("hidden", !isShellCommand);
  }
  renderSlashCommandMenu(getComposerSlashState());
}

function waitForNativeTerminalOpen(timeoutMs = 4000) {
  if (nativeTerminal?.isOpen?.()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const tick = () => {
      if (nativeTerminal?.isOpen?.()) {
        resolve(true);
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        resolve(false);
        return;
      }
      setTimeout(tick, 50);
    };
    tick();
  });
}

async function sendComposerShellCommand(command) {
  const text = String(command || "").trim();
  if (!text) {
    addStatus("$ の後に実行するコマンドを入力してください。");
    return false;
  }
  setMainMode("terminal");
  if (!selectedThread) {
    addStatus("thread が準備できてから $ コマンドを送信できます。");
    connect();
    return false;
  }
  if (!ensureNativeTerminalConnected({ focus: true })) {
    addStatus("ターミナル接続を開始できませんでした。");
    return false;
  }
  const opened = await waitForNativeTerminalOpen();
  if (!opened) {
    addStatus("ターミナル接続待ちがタイムアウトしました。");
    return false;
  }
  const sent = sendNativeTerminalInput(`${text}\r`);
  if (sent) addStatus(`ターミナルで実行: ${text}`);
  else addStatus("ターミナルへ送信できませんでした。");
  return sent;
}

function clearReconnectTimer() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
}

function scheduleReconnect() {
  if (reconnectTimer || (tokenRequired && !token)) return;
  const delay = Math.min(30_000, 1_000 * 2 ** reconnectAttempt);
  reconnectAttempt += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect({ autoReconnect: true });
  }, delay);
}

function connect(options = {}) {
  if (tokenRequired && !token) {
    addEntry("error", "URLに token がありません。Mac側に表示されたURLをそのまま開いてください。");
    return;
  }
  clearReconnectTimer();
  if (ws) ws.close();
  liveTurnActive = false;
  remoteSessionState = null;
  setRunState("connecting");
  lastHistorySignature = "";
  if (!selectedThread) renderHistory([]);
  const selected = threadCache.find((thread) => thread.id === selectedThread);
  threadTitle.textContent = selected ? titleForThread(selected) : "新しい共有thread";

  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const query = new URLSearchParams();
  if (tokenRequired && token) query.set("token", token);
  if (selectedThread) query.set("thread", selectedThread);
  if (!selectedThread) {
    if (nextThreadCwd) query.set("cwd", nextThreadCwd);
    if (forceNewThreadOnce) query.set("new", "1");
  }
  forceNewThreadOnce = false;
  nextThreadCwd = "";
  const bridgeQuery = query.toString();
  ws = new WebSocket(`${proto}//${location.host}/bridge${bridgeQuery ? `?${bridgeQuery}` : ""}`);
  const socket = ws;
  connectButton.disabled = true;
  meta.textContent = "接続中";
  syncHeaderCwd();

  ws.addEventListener("open", () => {
    if (socket !== ws) return;
    reconnectAttempt = 0;
    setRunState("connecting", "Codex に接続中");
    addEntry("status", "Macの共有ブリッジへ接続しました。");
  });

  ws.addEventListener("message", (event) => {
    if (socket !== ws) return;
    const msg = JSON.parse(event.data);
    if (msg.type === "ready") {
      setReady(true);
      setCurrentWorkdir(msg.workdir);
      const materialized = Boolean((msg.history || []).length);
      syncReadyThread(msg.threadId, { prewarmTerminal: materialized });
      currentGoal = normalizeGoalForDisplay(msg.goal || null);
      syncGoalIndicator(currentGoal);
      renderHistoryIfChanged(msg.history || []);
      meta.textContent = `${msg.model}  •  ${msg.clients}端末`;
      setRunState("ready");
      if (msg.sessionState) applyRemoteSessionState(msg.sessionState);
      addEntry("status", `共有Codex thread ready: ${msg.threadId}`);
      return;
    }
    if (msg.type === "goal") {
      currentGoal = normalizeGoalForDisplay(msg.goal || null);
      syncGoalIndicator(currentGoal);
      if (activePanel === "goal" && !document.body.classList.contains("hide-artifacts")) renderGoalView(currentGoal);
      return;
    }
    if (msg.type === "sessionState") {
      applyRemoteSessionState(msg.state);
      return;
    }
    if (msg.type === "user") {
      liveTurnActive = true;
      assistantEntry = null;
      setRunState("running");
      addEntry("user", msg.text, msg.attachments || []);
      return;
    }
    if (msg.type === "assistantDelta") {
      setRunState("streaming");
      const shouldStickToBottom = shouldAutoScrollLog();
      if (!assistantEntry) assistantEntry = addEntry("assistant", "");
      setEntryText(assistantEntry, "assistant", `${assistantEntry.markdownSource || ""}${msg.text}`);
      scrollLogToBottomIfNeeded(shouldStickToBottom);
      return;
    }
    if (msg.type === "approval") {
      pendingApproval = msg.request;
      setRunState("approval");
      approvalText.textContent = JSON.stringify(msg.request.params, null, 2);
      approval.classList.remove("hidden");
      return;
    }
    if (msg.type === "turn" && msg.status === "completed") {
      liveTurnActive = false;
      lastHistorySignature = "";
      assistantEntry = null;
      setRunState("done", "完了しました");
      if (!shouldHandleTurnCompleted()) return;
      maybeNotifyTurnCompleted();
      ensureNativeTerminalConnected({ focus: activeMainMode === "terminal" });
      loadThreads();
      refreshSelectedThread();
      return;
    }
    if (msg.type === "error") {
      if (recoverMissingSelectedThread(msg.text)) return;
      setRunState("error", msg.text || "エラー");
      addEntry("error", msg.text);
      return;
    }
    if (msg.type === "status") {
      if (/履歴同期を更新しました/.test(msg.text || "")) setRunState("done", "完了・履歴同期済み");
      else if (/履歴同期に失敗/.test(msg.text || "")) setRunState("error", "履歴同期に失敗");
      else if (/履歴同期/.test(msg.text || "")) setRunState("syncing", msg.text);
      addEntry("status", msg.text);
    }
  });

  ws.addEventListener("close", () => {
    if (socket !== ws) return;
    setReady(false);
    connectButton.disabled = false;
    meta.textContent = "切断";
    setRunState("disconnected");
    if (options.autoReconnect) addStatus("接続が切れたため再接続を継続します。");
    scheduleReconnect();
  });
}

composer.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = promptInput.value;
  const submitState = classifyComposerSubmit(text);
  if (submitState.kind === "empty") return;
  if (submitState.kind === "empty-shell") {
    addStatus("$ の後に実行するコマンドを入力してください。");
    return;
  }
  if (submitState.kind === "shell") {
    const sent = await sendComposerShellCommand(submitState.command);
    if (!sent) return;
    promptInput.value = "";
    updateComposerCommandUi();
    return;
  }
  if (submitState.kind === "slash") {
    executeSlashCommand(submitState.command);
    updateComposerCommandUi();
    return;
  }
  if (!sendPromptToBridge(submitState.text || text, pendingFiles)) return;
  promptInput.value = "";
  pendingFiles = [];
  renderAttachments();
  updateComposerCommandUi();
});
promptInput.addEventListener("keydown", (event) => {
  if (!event.isComposing && slashMenuState.open) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      updateSlashSelection(slashMenuState.selectedIndex + 1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      updateSlashSelection(slashMenuState.selectedIndex - 1);
      return;
    }
    if (event.key === "Enter" && !(event.metaKey || event.ctrlKey || event.shiftKey)) {
      event.preventDefault();
      executeSlashCommand(slashMenuState.candidates[slashMenuState.selectedIndex], { fromMenu: true });
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      hideSlashCommandMenu();
      return;
    }
  }
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    composer.requestSubmit();
  }
});
promptInput.addEventListener("input", updateComposerCommandUi);
promptInput.addEventListener("click", updateComposerCommandUi);
promptInput.addEventListener("keyup", (event) => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  updateComposerCommandUi();
});
document.addEventListener("click", (event) => {
  if (!slashMenuState.open) return;
  if (slashCommandMenu?.contains(event.target) || promptInput.contains(event.target)) return;
  hideSlashCommandMenu();
});

approveButton.addEventListener("click", () => {
  sendApprovalToBridge("accept");
});

declineButton.addEventListener("click", () => {
  sendApprovalToBridge("decline");
});

newThreadButton.addEventListener("click", () => openSessionCreatePage());
searchButton.addEventListener("click", () => {
  threadSearch.classList.toggle("hidden");
  threadSearch.focus();
  renderThreadList();
  openSidebar();
});
threadSearch.addEventListener("input", renderThreadList);
pluginsButton.addEventListener("click", showPlugins);
automationsButton.addEventListener("click", showAutomations);
settingsButton.addEventListener("click", showSettings);
mobileThreadsButton.addEventListener("click", () => {
  if (document.body.classList.contains("show-sidebar")) closeSidebar({ restoreFocus: true });
  else openSidebar({ focus: true });
});
sidebarScrim.addEventListener("click", () => closeSidebar({ restoreFocus: true }));
connectButton.addEventListener("click", connect);
menuButton.addEventListener("click", () => {
  const desktopPanelVisible =
    window.matchMedia("(min-width: 1101px)").matches && !document.body.classList.contains("hide-artifacts");
  const mobilePanelVisible = document.body.classList.contains("show-panel");
  if (desktopPanelVisible || mobilePanelVisible) {
    closeRightPanel({ restoreFocus: true });
    addStatus("右パネルを閉じました。");
  } else {
    showRightPanel({ focus: window.matchMedia("(max-width: 1100px)").matches });
    addStatus("右パネルを開きました。");
  }
});
pathbarColorPicker?.addEventListener("input", () => {
  savePathbarColorForCurrentWorkdir(pathbarColorPicker.value);
});
sessionSwitcher?.addEventListener("click", openSessionSwitcher);
sessionSwitcher?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    openSessionSwitcher();
  }
});
sessionSwitcherClose?.addEventListener("click", closeSessionSwitcher);
sessionSwitcherNew?.addEventListener("click", () => openSessionCreatePage());
sessionCreateCancel?.addEventListener("click", closeSessionCreatePage);
sessionRecentClear?.addEventListener("click", clearSessionRecentHistory);
sessionBrowserUp?.addEventListener("click", () => {
  if (sessionBrowserParentPath) void loadSessionBrowser(sessionBrowserParentPath);
});
sessionDirectorySearch?.addEventListener("input", renderSessionBrowserEntries);
sessionHiddenToggle?.addEventListener("change", () => {
  sessionShowHidden = Boolean(sessionHiddenToggle.checked);
  void loadSessionBrowser(sessionBrowserCurrentPath || defaultDeveloperPath(), { preserveSearch: true });
});
sessionStartButton?.addEventListener("click", startSelectedSession);
closePanelButton.addEventListener("click", () => closeRightPanel({ restoreFocus: true }));
for (const button of modeButtons) {
  button.addEventListener("click", () => setMainMode(button.dataset.mainMode));
}
terminalReconnect?.addEventListener("click", () => {
  setMainMode("terminal");
  ensureNativeTerminalConnected({ force: true });
});
terminalThemeToggle?.addEventListener("click", () => {
  terminalThemeMode = terminalThemeMode === "dark" ? "light" : "dark";
  localStorage.setItem("codexTerminalThemeMode", terminalThemeMode);
  applyTerminalTheme();
});
terminalZoomOut?.addEventListener("click", () => {
  const index = terminalFontSizes.indexOf(terminalFontSize);
  if (index <= 0) return;
  terminalFontSize = terminalFontSizes[index - 1];
  localStorage.setItem("codexTerminalFontSize", String(terminalFontSize));
  applyTerminalFontSize();
});
terminalZoomIn?.addEventListener("click", () => {
  const index = terminalFontSizes.indexOf(terminalFontSize);
  if (index < 0 || index >= terminalFontSizes.length - 1) return;
  terminalFontSize = terminalFontSizes[index + 1];
  localStorage.setItem("codexTerminalFontSize", String(terminalFontSize));
  applyTerminalFontSize();
});
for (const button of terminalModeButtons) {
  button.addEventListener("click", () => setTerminalInputMode(button.dataset.terminalInputMode));
}
for (const button of terminalNativeInputButtons) {
  button.addEventListener("click", () => sendNativeTerminalInput(button.dataset.terminalPtyInput || ""));
}
for (const button of terminalActionButtons) {
  button.addEventListener("click", () => void handleTerminalAction(button.dataset.terminalAction));
}
terminalSend?.addEventListener("click", submitTerminalPrompt);
terminalPrompt?.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    submitTerminalPrompt();
  }
});
terminalPrompt?.addEventListener("input", () => {
  if (terminalSend) terminalSend.textContent = terminalPrompt.value.length === 0 ? "Enter ↵" : "Send";
});
terminalCtrlCButton?.addEventListener("click", showTerminalCtrlCConfirm);
terminalCtrlCCancel?.addEventListener("click", hideTerminalCtrlCConfirm);
terminalCtrlCConfirmButton?.addEventListener("click", () => {
  sendNativeTerminalInput("\u0003");
  hideTerminalCtrlCConfirm();
});
terminalFileInput?.addEventListener("change", () => {
  const file = terminalFileInput.files?.[0];
  terminalFileInput.value = "";
  if (!file) return;
  appendTerminalPromptLine(`添付画像: ${file.name}`);
  addStatus("画像名をターミナル入力欄に追加しました。実ファイルの参照が必要な場合はフォルダパスも追加してください。");
});
artifactPreview.addEventListener("click", (event) => {
  if (event.target.closest("[data-preview-close]")) hideArtifactPreview();
});
addButton.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", async () => {
  const files = Array.from(fileInput.files || []).filter((file) => file.type.startsWith("image/"));
  try {
    pendingFiles = pendingFiles.concat(await Promise.all(files.map(readFileAsDataUrl)));
    renderAttachments();
    if (files.length) addStatus(`${files.length}件の画像を添付しました。送信時にCodexへ渡します。`);
  } catch (error) {
    addEntry("error", `添付に失敗しました: ${error.message}`);
  } finally {
    fileInput.value = "";
  }
});
accessButton.addEventListener("click", () => {
  const index = accessModes.findIndex((candidate) => candidate.label === accessMode.label);
  accessMode = accessModes[(index + 1) % accessModes.length];
  setAccessButtonLabel();
  addStatus(`権限を ${accessMode.label} に切り替えました。次の送信から反映します。`);
});
modelButton.addEventListener("click", toggleModelMenu);
voiceButton.addEventListener("click", startVoiceInput);
modelMenu.addEventListener("click", (event) => {
  const reasoningRow = event.target.closest("[data-reasoning]");
  if (reasoningRow) {
    selectReasoning(reasoningRow.dataset.reasoning);
    return;
  }
  const modelRow = event.target.closest("[data-model-choice]");
  if (modelRow) {
    selectModel(modelRow.dataset.modelChoice);
    return;
  }
  if (event.target.closest("#moreModelsButton")) {
    closeModelMenu();
    showModels();
  }
});
document.addEventListener("click", async (event) => {
  const artifactOpen = event.target.closest("[data-open-artifact-path]");
  if (artifactOpen) {
    showArtifact(artifactOpen.dataset.openArtifactPath);
    return;
  }

  const button = event.target.closest("[data-message-action='copy']");
  if (!button) return;
  const entry = button.closest(".entry");
  const body = entry?.querySelector(".entry-body");
  const text = body?.markdownSource || body?.innerText || "";
  if (!text.trim()) return;
  const copied = await copyTextToClipboard(text);
  if (copied) {
    addStatus("メッセージをコピーしました。");
  } else {
    appendToPrompt(text);
    addStatus("クリップボードに書き込めないため、入力欄へ追加しました。");
  }
});
document.addEventListener("click", (event) => {
  if (modelMenu.classList.contains("hidden")) return;
  if (modelMenu.contains(event.target) || modelButton.contains(event.target)) return;
  closeModelMenu();
});
document.addEventListener("keydown", (event) => {
  if (modelMenu.classList.contains("hidden")) return;
  if (event.key === "Escape") {
    closeModelMenu();
    modelButton.focus();
    return;
  }
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const rows = Array.from(modelMenu.querySelectorAll(".model-menu-row"));
  const current = rows.indexOf(document.activeElement);
  let next = current;
  if (event.key === "Home") next = 0;
  else if (event.key === "End") next = rows.length - 1;
  else if (event.key === "ArrowDown") next = current < rows.length - 1 ? current + 1 : 0;
  else if (event.key === "ArrowUp") next = current > 0 ? current - 1 : rows.length - 1;
  rows[next]?.focus();
});
document.addEventListener("click", (event) => {
  if (!document.body.classList.contains("show-panel")) return;
  if (window.matchMedia("(min-width: 1101px)").matches) return;
  if (artifactPanel.contains(event.target) || menuButton.contains(event.target)) return;
  closeRightPanel({ restoreFocus: true });
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (document.body.classList.contains("show-panel")) {
    closeRightPanel({ restoreFocus: true });
    return;
  }
  if (document.body.classList.contains("show-sidebar")) {
    closeSidebar({ restoreFocus: true });
  }
});
statusButton.addEventListener("click", showStatus);
artifactTab?.addEventListener("click", () => renderArtifactIndex(artifactItems));
workspaceTab?.addEventListener("click", showWorkspace);
reviewTab?.addEventListener("click", showReview);
goalTab?.addEventListener("click", showGoal);
archiveTab?.addEventListener("click", () => showArchive(true));
webSearchButton.addEventListener("click", showSources);
for (const button of artifactButtons) {
  button.addEventListener("click", () => {
    for (const candidate of artifactButtons) candidate.classList.toggle("active", candidate === button);
    showArtifact(button.dataset.artifact);
  });
}

setReady(false);
setMainMode(activeMainMode);
setTerminalInputMode(terminalInputMode);
applyTerminalTheme();
applyTerminalFontSize();
if (terminalSend && terminalPrompt) terminalSend.textContent = terminalPrompt.value.length === 0 ? "Enter ↵" : "Send";
setAccessButtonLabel();
updateModelButton();
modelButton.setAttribute("aria-haspopup", "menu");
modelButton.setAttribute("aria-expanded", "false");
loadPanelWidths();
bindResizeHandle(leftResizeHandle, "left");
bindResizeHandle(rightResizeHandle, "right");
bindSessionSwipe();
syncSidebarState();
syncRightPanelState();
renderSessionChrome();
renderSessionCreatePage();
loadBridgeInfo()
  .then(() => loadArtifacts())
  .then(() => loadThreads().catch(() => {}))
  .then(() => {
    restoreActiveSessionFromStorage();
    connect();
  })
  .catch(() => {
    setRunState("error", "bridge情報を確認できません");
  });
setInterval(() => refreshLiveThreads({ background: true }), 5_000);
setInterval(refreshSelectedThread, 3_000);
