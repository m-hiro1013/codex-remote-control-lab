const path = require("path");

function stripUiDirectives(text) {
  return String(text || "")
    .replace(/(?:^|\n)::[a-z0-9-]+\{[^\n]*\}(?=\n|$)/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function summarizeLiveItem(item, phase = "completed") {
  if (!item) return null;
  if (item.type === "commandExecution") {
    return phase === "started" ? `$ ${item.command}` : null;
  }
  if (item.type === "fileChange") {
    return `file changes: ${item.status}`;
  }
  return null;
}

function createThreadHistory({ root, uploadDir, isImagePath, limit = 80 }) {
  function summarizeItem(item) {
    if (item.type === "userMessage") {
      const textParts = [];
      const attachments = [];
      for (const part of item.content) {
        if (part.type === "text") {
          textParts.push(part.text);
          continue;
        }
        if (part.type === "localImage" && part.path) {
          const absolutePath = path.resolve(part.path);
          if (absolutePath.startsWith(`${uploadDir}${path.sep}`)) {
            attachments.push({
              name: path.basename(absolutePath),
              url: `/api/uploaded?name=${encodeURIComponent(path.basename(absolutePath))}`,
            });
          } else if (absolutePath.startsWith(`${root}${path.sep}`) && isImagePath(absolutePath)) {
            const relative = path.relative(root, absolutePath);
            attachments.push({ name: path.basename(absolutePath), url: `/api/file/raw?path=${encodeURIComponent(relative)}` });
          }
        }
      }
      return {
        type: "user",
        text: textParts.join("\n") || (attachments.length ? "添付画像" : ""),
        attachments,
      };
    }
    if (item.type === "agentMessage") return { type: "assistant", text: stripUiDirectives(item.text) };
    if (item.type === "commandExecution") return { type: "status", text: `$ ${item.command}` };
    if (item.type === "fileChange") return { type: "status", text: `file changes: ${item.status}` };
    return null;
  }

  function capHistory(history) {
    return history.slice(-limit);
  }

  function historyFromThread(thread) {
    const history = [];
    for (const turn of thread.turns || []) {
      for (const item of turn.items || []) {
        const entry = summarizeItem(item);
        if (entry && entry.text) history.push(entry);
      }
    }
    return capHistory(history);
  }

  return { capHistory, historyFromThread, summarizeItem };
}

module.exports = {
  createThreadHistory,
  stripUiDirectives,
  summarizeLiveItem,
};
