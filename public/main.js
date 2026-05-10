const log = document.querySelector("#log");
const meta = document.querySelector("#meta");
const connectButton = document.querySelector("#connect");
const newThreadButton = document.querySelector("#newThread");
const searchButton = document.querySelector("#searchButton");
const pluginsButton = document.querySelector("#pluginsButton");
const automationsButton = document.querySelector("#automationsButton");
const settingsButton = document.querySelector("#settingsButton");
const menuButton = document.querySelector("#menuButton");
const addButton = document.querySelector("#addButton");
const accessButton = document.querySelector("#accessButton");
const thinkingButton = document.querySelector("#thinkingButton");
const mobileThreadsButton = document.querySelector("#mobileThreads");
const sidebarScrim = document.querySelector("#sidebarScrim");
const artifactPanel = document.querySelector(".artifact-panel");
const artifactButtons = document.querySelectorAll("[data-artifact]");
const threadList = document.querySelector("#threadList");
const threadTitle = document.querySelector("#threadTitle");
const composer = document.querySelector("#composer");
const promptInput = document.querySelector("#prompt");
const sendButton = document.querySelector("#send");
const approval = document.querySelector("#approval");
const approvalText = document.querySelector("#approvalText");
const approveButton = document.querySelector("#approve");
const declineButton = document.querySelector("#decline");

const params = new URLSearchParams(location.search);
const token = params.get("token") || localStorage.getItem("codexPhoneToken") || "";
let selectedThread = params.get("thread") || "";
if (token) localStorage.setItem("codexPhoneToken", token);

let ws = null;
let pendingApproval = null;
let assistantEntry = null;
let threadCache = [];
let accessMode = "フルアクセス";

function titleForThread(thread) {
  const raw = thread.name || thread.preview || thread.cwd || thread.id;
  const firstLine = raw.split("\n").find(Boolean) || thread.id;
  return firstLine.length > 54 ? `${firstLine.slice(0, 54)}...` : firstLine;
}

function addEntry(kind, text) {
  const el = document.createElement("article");
  el.className = `entry ${kind}`;

  const avatar = document.createElement("div");
  avatar.className = "entry-avatar";
  avatar.textContent = kind === "user" ? "U" : kind === "assistant" ? "C" : "›";

  const body = document.createElement("div");
  body.className = "entry-body";
  body.textContent = text;

  const tools = document.createElement("div");
  tools.className = "entry-tools";
  tools.textContent = kind === "assistant" ? "□  ↗" : "";

  el.append(avatar, body, tools);
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
  return body;
}

function addStatus(text) {
  addEntry("status", text);
}

function setReady(ready) {
  sendButton.disabled = !ready;
  promptInput.disabled = !ready;
}

function renderHistory(history) {
  log.replaceChildren();
  for (const entry of history || []) addEntry(entry.type, entry.text);
}

function renderThreadList() {
  threadList.replaceChildren();
  const fresh = document.createElement("button");
  fresh.type = "button";
  fresh.className = selectedThread ? "thread-item" : "thread-item active";
  fresh.textContent = "新しい共有thread";
  fresh.addEventListener("click", () => selectThread(""));
  threadList.appendChild(fresh);

  for (const thread of threadCache) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = thread.id === selectedThread ? "thread-item active" : "thread-item";
    item.textContent = titleForThread(thread);
    item.title = titleForThread(thread);
    item.addEventListener("click", () => selectThread(thread.id));
    threadList.appendChild(item);
  }
}

async function loadThreads() {
  if (!token) return;
  try {
    const response = await fetch(`/api/threads?token=${encodeURIComponent(token)}`, { cache: "no-store" });
    const result = await response.json();
    threadCache = result.data || [];
    renderThreadList();
  } catch (error) {
    addEntry("error", `thread一覧を読めませんでした: ${error.message}`);
  }
}

function updateUrlThread() {
  const next = new URL(location.href);
  if (selectedThread) next.searchParams.set("thread", selectedThread);
  else next.searchParams.delete("thread");
  history.replaceState(null, "", next);
}

function selectThread(threadId) {
  selectedThread = threadId;
  updateUrlThread();
  renderThreadList();
  document.body.classList.remove("show-sidebar");
  connect();
}

function showToolStatus(name) {
  addStatus(`${name} パネルを選択しました。ブラウザ版ではこの操作を会話ログに記録します。`);
  document.body.classList.remove("show-sidebar");
}

function connect() {
  if (!token) {
    addEntry("error", "URLに token がありません。Mac側に表示されたURLをそのまま開いてください。");
    return;
  }
  if (ws) ws.close();
  renderHistory([]);
  const selected = threadCache.find((thread) => thread.id === selectedThread);
  threadTitle.textContent = selected ? titleForThread(selected) : "新しい共有thread";

  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const threadParam = selectedThread ? `&thread=${encodeURIComponent(selectedThread)}` : "";
  ws = new WebSocket(`${proto}//${location.host}/bridge?token=${encodeURIComponent(token)}${threadParam}`);
  connectButton.disabled = true;
  meta.textContent = "接続中";

  ws.addEventListener("open", () => {
    addEntry("status", "Macの共有ブリッジへ接続しました。");
  });

  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === "ready") {
      setReady(true);
      renderHistory(msg.history || []);
      meta.textContent = `${msg.model}  •  ${msg.clients}端末  •  ${msg.workdir}`;
      addEntry("status", `共有Codex thread ready: ${msg.threadId}`);
      return;
    }
    if (msg.type === "user") {
      assistantEntry = null;
      addEntry("user", msg.text);
      return;
    }
    if (msg.type === "assistantDelta") {
      if (!assistantEntry) assistantEntry = addEntry("assistant", "");
      assistantEntry.textContent += msg.text;
      log.scrollTop = log.scrollHeight;
      return;
    }
    if (msg.type === "approval") {
      pendingApproval = msg.request;
      approvalText.textContent = JSON.stringify(msg.request.params, null, 2);
      approval.classList.remove("hidden");
      return;
    }
    if (msg.type === "turn" && msg.status === "completed") {
      assistantEntry = null;
      loadThreads();
      return;
    }
    if (msg.type === "error") {
      addEntry("error", msg.text);
      return;
    }
    if (msg.type === "status") {
      addEntry("status", msg.text);
    }
  });

  ws.addEventListener("close", () => {
    setReady(false);
    connectButton.disabled = false;
    meta.textContent = "切断";
  });
}

composer.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = promptInput.value.trim();
  if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "prompt", token, text }));
  promptInput.value = "";
});

approveButton.addEventListener("click", () => {
  if (!pendingApproval) return;
  ws.send(JSON.stringify({ type: "approval", token, decision: "accept", request: pendingApproval }));
  approval.classList.add("hidden");
  pendingApproval = null;
});

declineButton.addEventListener("click", () => {
  if (!pendingApproval) return;
  ws.send(JSON.stringify({ type: "approval", token, decision: "decline", request: pendingApproval }));
  approval.classList.add("hidden");
  pendingApproval = null;
});

newThreadButton.addEventListener("click", () => selectThread(""));
searchButton.addEventListener("click", () => {
  addStatus("検索を選択しました。最近のチャット一覧から目的のthreadを選べます。");
  promptInput.focus();
});
pluginsButton.addEventListener("click", () => showToolStatus("プラグイン"));
automationsButton.addEventListener("click", () => showToolStatus("オートメーション"));
settingsButton.addEventListener("click", () => showToolStatus("設定"));
mobileThreadsButton.addEventListener("click", () => document.body.classList.toggle("show-sidebar"));
sidebarScrim.addEventListener("click", () => document.body.classList.remove("show-sidebar"));
connectButton.addEventListener("click", connect);
menuButton.addEventListener("click", () => {
  document.body.classList.toggle("hide-artifacts");
  addStatus(document.body.classList.contains("hide-artifacts") ? "右パネルを閉じました。" : "右パネルを開きました。");
});
addButton.addEventListener("click", () => addStatus("添付ボタンを押しました。ローカルファイル添付UIは次の実装対象です。"));
accessButton.addEventListener("click", () => {
  accessMode = accessMode === "フルアクセス" ? "確認モード" : "フルアクセス";
  accessButton.textContent = `${accessMode}⌄`;
  addStatus(`権限表示を ${accessMode} に切り替えました。`);
});
thinkingButton.addEventListener("click", () => addStatus("推論/処理状態ボタンを押しました。現在のthread状態を会話ログに記録しました。"));
for (const button of artifactButtons) {
  button.addEventListener("click", () => {
    for (const candidate of artifactButtons) candidate.classList.toggle("active", candidate === button);
    addStatus(`${button.dataset.artifact} をアーティファクトとして選択しました。`);
  });
}

setReady(false);
loadThreads().finally(connect);
