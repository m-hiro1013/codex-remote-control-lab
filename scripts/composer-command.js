const SLASH_COMMANDS = [
  { id: "new", value: "/new", label: "/new", description: "新しいチャットを開始", action: "new-thread" },
  { id: "compact", value: "/compact", label: "/compact", description: "会話を圧縮する指示を入力", action: "insert" },
  { id: "diff", value: "/diff", label: "/diff", description: "差分レビューを開く", action: "review" },
  { id: "review", value: "/review", label: "/review", description: "差分レビューを開く", action: "review" },
  { id: "status", value: "/status", label: "/status", description: "実行状態を開く", action: "status" },
  { id: "model", value: "/model", label: "/model", description: "モデルメニューを開く", action: "model" },
  { id: "approvals", value: "/approvals", label: "/approvals", description: "承認待ち確認の指示を入力", action: "insert" },
  { id: "init", value: "/init", label: "/init", description: "初期化指示を入力", action: "insert" },
  { id: "goal", value: "/goal", label: "/goal", description: "Goal パネルを開く", action: "goal" },
];

function normalizeCommandQuery(value) {
  return String(value || "").replace(/^\//, "").trim().toLowerCase();
}

function slashCommandCandidates(query = "", commands = SLASH_COMMANDS) {
  const normalized = normalizeCommandQuery(query);
  if (!normalized) return commands.slice();
  return commands.filter((command) => {
    const id = String(command.id || "").toLowerCase();
    const value = String(command.value || "").replace(/^\//, "").toLowerCase();
    return id.startsWith(normalized) || value.startsWith(normalized);
  });
}

function getComposerCommandState(text = "", selectionStart = String(text || "").length, commands = SLASH_COMMANDS) {
  const value = String(text || "");
  const cursor = Math.max(0, Math.min(Number(selectionStart) || 0, value.length));
  const beforeCursor = value.slice(0, cursor);
  const lineStart = beforeCursor.lastIndexOf("\n") + 1;
  const line = beforeCursor.slice(lineStart);
  if (!line.startsWith("/")) return { kind: "none" };
  if (/\s/.test(line)) return { kind: "none" };
  const query = line.slice(1);
  return {
    kind: "slash",
    query,
    replaceStart: lineStart,
    replaceEnd: cursor,
    candidates: slashCommandCandidates(query, commands),
  };
}

function classifyComposerSubmit(text = "", commands = SLASH_COMMANDS) {
  const raw = String(text || "");
  const trimmed = raw.trim();
  if (!trimmed) return { kind: "empty" };
  const leadingTrimmed = raw.trimStart();
  if (leadingTrimmed.startsWith("$")) {
    const command = leadingTrimmed.slice(1).trim();
    return command ? { kind: "shell", command } : { kind: "empty-shell" };
  }
  if (trimmed.startsWith("/") && !/\s/.test(trimmed)) {
    const command = slashCommandCandidates(trimmed.slice(1), commands).find((candidate) => candidate.value === trimmed);
    if (command) return { kind: "slash", command };
  }
  return { kind: "chat", text: trimmed };
}

module.exports = {
  SLASH_COMMANDS,
  classifyComposerSubmit,
  getComposerCommandState,
  slashCommandCandidates,
};
