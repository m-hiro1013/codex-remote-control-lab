var CodexComposerCommand = (() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // scripts/composer-command.js
  var require_composer_command = __commonJS({
    "scripts/composer-command.js"(exports, module) {
      var SLASH_COMMANDS = [
        { id: "new", value: "/new", label: "/new", description: "\u65B0\u3057\u3044\u30C1\u30E3\u30C3\u30C8\u3092\u958B\u59CB", action: "new-thread" },
        { id: "compact", value: "/compact", label: "/compact", description: "\u4F1A\u8A71\u3092\u5727\u7E2E\u3059\u308B\u6307\u793A\u3092\u5165\u529B", action: "insert" },
        { id: "diff", value: "/diff", label: "/diff", description: "\u5DEE\u5206\u30EC\u30D3\u30E5\u30FC\u3092\u958B\u304F", action: "review" },
        { id: "review", value: "/review", label: "/review", description: "\u5DEE\u5206\u30EC\u30D3\u30E5\u30FC\u3092\u958B\u304F", action: "review" },
        { id: "status", value: "/status", label: "/status", description: "\u5B9F\u884C\u72B6\u614B\u3092\u958B\u304F", action: "status" },
        { id: "model", value: "/model", label: "/model", description: "\u30E2\u30C7\u30EB\u30E1\u30CB\u30E5\u30FC\u3092\u958B\u304F", action: "model" },
        { id: "approvals", value: "/approvals", label: "/approvals", description: "\u627F\u8A8D\u5F85\u3061\u78BA\u8A8D\u306E\u6307\u793A\u3092\u5165\u529B", action: "insert" },
        { id: "init", value: "/init", label: "/init", description: "\u521D\u671F\u5316\u6307\u793A\u3092\u5165\u529B", action: "insert" },
        { id: "goal", value: "/goal", label: "/goal", description: "Goal \u30D1\u30CD\u30EB\u3092\u958B\u304F", action: "goal" }
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
          candidates: slashCommandCandidates(query, commands)
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
        slashCommandCandidates
      };
    }
  });
  return require_composer_command();
})();
