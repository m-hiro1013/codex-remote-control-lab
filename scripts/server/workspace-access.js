const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const defaultImageExtensions = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".svg", "image/svg+xml"],
]);

const ignoredWorkspaceNames = new Set([
  ".git",
  ".claude",
  ".codex-home",
  ".uploads",
  "node_modules",
  "coverage",
  "dist",
]);

function createWorkspaceAccess(options = {}) {
  const root = path.resolve(options.root || path.join(__dirname, "..", ".."));
  const workdir = path.resolve(options.workdir || root);
  const uploadDir = path.resolve(options.uploadDir || path.join(root, ".uploads"));
  const imageExtensions = options.imageExtensions || defaultImageExtensions;
  const env = options.env || process.env;

  function safePathWithin(base, input) {
    const resolvedBase = path.resolve(base);
    const raw = String(input || "");
    const clean = raw.replace(/^[/\\]+/, "");
    const target = path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(resolvedBase, clean);
    if (!target.startsWith(`${resolvedBase}${path.sep}`) && target !== resolvedBase) return null;
    return target;
  }

  function safeRelativePath(input) {
    return safePathWithin(root, input);
  }

  function safeWorkdirPath(input) {
    return safePathWithin(workdir, input);
  }

  function safeDirectoryPath(input, base = os.homedir()) {
    const raw = String(input || base);
    const resolvedBase = path.resolve(base);
    const resolved = path.resolve(raw);
    try {
      const realBase = fs.realpathSync(resolvedBase);
      const realTarget = fs.realpathSync(resolved);
      const stat = fs.statSync(realTarget);
      if (!stat.isDirectory()) return null;
      if (realTarget !== realBase && !realTarget.startsWith(`${realBase}${path.sep}`)) return null;
      return {
        absolute: realTarget,
        name: path.basename(realTarget) || realTarget,
        parent: realTarget === realBase ? null : path.dirname(realTarget),
      };
    } catch {
      return null;
    }
  }

  function readDirectoryListing(input, showHidden = false, base = os.homedir()) {
    const directory = safeDirectoryPath(input || base, base);
    if (!directory) return null;
    let children;
    try {
      children = fs.readdirSync(directory.absolute, { withFileTypes: true });
    } catch {
      children = [];
    }
    const entries = children
      .filter((entry) => entry.isDirectory())
      .filter((entry) => showHidden || !entry.name.startsWith("."))
      .map((entry) => ({ name: entry.name, path: path.join(directory.absolute, entry.name) }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      root: safeDirectoryPath(base, base)?.absolute || path.resolve(base),
      path: directory.absolute,
      name: directory.name,
      parent: directory.parent,
      entries,
    };
  }

  function safeOpenPath(input) {
    const workspacePath = safeWorkdirPath(input);
    if (workspacePath) {
      try {
        if (fs.statSync(workspacePath).isFile()) return workspacePath;
      } catch {}
    }
    return safeRelativePath(input);
  }

  function relativeDisplayPath(filePath) {
    const base = filePath.startsWith(`${workdir}${path.sep}`) || filePath === workdir ? workdir : root;
    return path.relative(base, filePath);
  }

  function safeUploadPath(input) {
    const clean = String(input || "").replace(/^[/\\]+/, "");
    const target = path.resolve(uploadDir, clean);
    if (!target.startsWith(`${uploadDir}${path.sep}`) && target !== uploadDir) return null;
    return target;
  }

  function mimeForPath(filePath) {
    return imageExtensions.get(path.extname(filePath).toLowerCase()) || "application/octet-stream";
  }

  function isImagePath(filePath) {
    return imageExtensions.has(path.extname(filePath).toLowerCase());
  }

  function discoverArtifacts() {
    const files = ["README.md", "AGENTS.md"];
    const assetsDir = path.join(root, "docs", "assets");
    if (fs.existsSync(assetsDir)) {
      for (const name of fs.readdirSync(assetsDir).sort()) {
        const relative = path.join("docs", "assets", name);
        const full = path.join(root, relative);
        if (fs.statSync(full).isFile() && (isImagePath(full) || /\.md(?:own)?$/i.test(name))) files.push(relative);
      }
    }
    return files.map((file) => ({
      path: file,
      name: path.basename(file),
      kind: isImagePath(file) ? "image" : /\.md(?:own)?$/i.test(file) ? "markdown" : "file",
    }));
  }

  function shouldSkipWorkspaceEntry(name) {
    return ignoredWorkspaceNames.has(name) || /^\.codex-home/.test(name) || /^\.phone-token/.test(name) || /^\.env(?:\.|$)/.test(name);
  }

  function workspaceKind(filePath, stat) {
    if (stat.isDirectory()) return "directory";
    if (isImagePath(filePath)) return "image";
    if (/\.md(?:own)?$/i.test(filePath)) return "markdown";
    return "file";
  }

  function artifactKindForPath(filePath) {
    if (isImagePath(filePath)) return "image";
    if (/\.md(?:own)?$/i.test(filePath)) return "markdown";
    return "file";
  }

  async function discoverWorkspaceEntries({ limit = 200, query = "" } = {}) {
    const entries = [];
    const normalizedQuery = query.trim().toLowerCase();
    const maxEntries = Math.max(1, Math.min(Number(limit) || 200, 500));

    async function walk(dir, depth) {
      if (entries.length >= maxEntries || depth > 5) return;
      let children;
      try {
        children = await fs.promises.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      children = children
        .filter((entry) => !shouldSkipWorkspaceEntry(entry.name))
        .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));

      for (const child of children) {
        if (entries.length >= maxEntries) return;
        const fullPath = path.join(dir, child.name);
        let stat;
        try {
          stat = await fs.promises.stat(fullPath);
        } catch {
          continue;
        }
        if (!stat.isDirectory() && !stat.isFile()) continue;
        const relative = path.relative(workdir, fullPath);
        if (normalizedQuery && !relative.toLowerCase().includes(normalizedQuery)) {
          if (stat.isDirectory()) await walk(fullPath, depth + 1);
          continue;
        }
        entries.push({
          path: relative,
          name: child.name,
          type: stat.isDirectory() ? "directory" : "file",
          kind: workspaceKind(fullPath, stat),
          size: stat.isFile() ? stat.size : null,
        });
        if (stat.isDirectory()) await walk(fullPath, depth + 1);
      }
    }

    await walk(workdir, 0);
    return entries;
  }

  function runGit(args) {
    return new Promise((resolve, reject) => {
      const child = spawn("git", args, {
        cwd: workdir,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error(`git ${args.join(" ")} timed out`));
      }, 5000);

      child.stdout.on("data", (data) => {
        stdout += data;
        if (stdout.length > 512 * 1024) child.kill("SIGTERM");
      });
      child.stderr.on("data", (data) => {
        stderr += data;
        if (stderr.length > 512 * 1024) child.kill("SIGTERM");
      });
      child.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(new Error((stderr || stdout || `git ${args.join(" ")} failed`).trim()));
          return;
        }
        resolve(stdout.replace(/\s+$/g, ""));
      });
    });
  }

  function shouldSkipReviewPath(filePath) {
    const clean = String(filePath || "").replace(/^[/\\]+/, "").replace(/[\\/]+$/, "");
    return (
      clean === ".claude" ||
      clean.startsWith(".claude/") ||
      clean === ".phone-token" ||
      clean.startsWith(".codex-home") ||
      clean.startsWith(".uploads/") ||
      clean.startsWith("node_modules/")
    );
  }

  function parseGitPathName(rawPath) {
    let filePath = String(rawPath || "");
    if (!filePath.includes(" => ")) return filePath;
    if (/\{[^}]*\s=>\s[^}]*\}/.test(filePath)) {
      return filePath.replace(/\{[^}]*\s=>\s([^}]*)\}/g, "$1");
    }
    return filePath.split(" => ").pop().replace(/[{}]/g, "");
  }

  function parseNumstat(numstatText) {
    return new Map(
      numstatText
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => {
          const [added, deleted, ...rest] = line.split(/\t/);
          const filePath = parseGitPathName(rest.join("\t"));
          return [
            filePath,
            {
              additions: Number(added) || 0,
              deletions: Number(deleted) || 0,
            },
          ];
        }),
    );
  }

  function parseStatusPorcelain(statusText) {
    const records = String(statusText || "").split("\0").filter(Boolean);
    const files = [];
    for (let i = 0; i < records.length; i += 1) {
      const record = records[i];
      const status = record.slice(0, 2).trim() || "modified";
      const filePath = record.slice(3);
      if (!filePath) continue;
      files.push({ status, path: filePath });
      if (/[RC]/.test(status) && i + 1 < records.length) i += 1;
    }
    return files;
  }

  async function decorateReviewFiles(files) {
    const decorated = await Promise.all(files
      .filter((file) => !shouldSkipReviewPath(file.path))
      .map(async (file) => {
        const absolutePath = safeWorkdirPath(file.path);
        let openable = false;
        try {
          openable = Boolean(absolutePath && (await fs.promises.stat(absolutePath)).isFile());
        } catch {
          openable = false;
        }
        return {
          ...file,
          kind: openable ? artifactKindForPath(absolutePath) : "file",
          openable,
        };
      }));
    const totals = decorated.reduce(
      (sum, file) => ({
        additions: sum.additions + (file.additions || 0),
        deletions: sum.deletions + (file.deletions || 0),
      }),
      { additions: 0, deletions: 0 },
    );
    return { files: decorated, totals };
  }

  function workingTreeReviewFiles(statusText, numstatText) {
    const numstat = parseNumstat(numstatText);
    return parseStatusPorcelain(statusText)
      .map((file) => {
        const filePath = parseGitPathName(file.path);
        const stats = numstat.get(filePath) || { additions: 0, deletions: 0 };
        return {
          status: file.status,
          path: filePath,
          additions: stats.additions,
          deletions: stats.deletions,
        };
      });
  }

  async function lastCommitReviewFiles() {
    const numstat = parseNumstat(await runGit(["show", "--numstat", "--format=", "--no-renames", "HEAD"]));
    const names = (await runGit(["show", "--name-status", "--format=", "--no-renames", "HEAD"]))
      .split(/\r?\n/)
      .filter(Boolean);
    return names.map((line) => {
      const [status, ...rest] = line.split(/\t/);
      const filePath = rest.join("\t");
      const stats = numstat.get(filePath) || { additions: 0, deletions: 0 };
      return {
        status,
        path: filePath,
        additions: stats.additions,
        deletions: stats.deletions,
      };
    });
  }

  async function reviewSummary() {
    const [branch, statusText, statText, numstatText] = await Promise.all([
      runGit(["branch", "--show-current"]),
      runGit(["status", "--porcelain=v1", "-z"]),
      runGit(["diff", "HEAD", "--stat", "--"]),
      runGit(["diff", "HEAD", "--numstat", "--"]),
    ]);
    const working = await decorateReviewFiles(workingTreeReviewFiles(statusText, numstatText));
    const fallback = working.files.length ? null : await decorateReviewFiles(await lastCommitReviewFiles());
    const source = fallback ? "latest commit" : "working tree";
    const files = fallback?.files || working.files;
    const totals = fallback?.totals || working.totals;
    return {
      branch,
      clean: files.length === 0,
      source,
      files,
      totals,
      stat: statText.split(/\r?\n/).filter(Boolean).slice(0, 20),
    };
  }

  function readAutomations() {
    const home = env.CODEX_HOME || path.join(os.homedir(), ".codex");
    const automationsDir = path.join(home, "automations");
    if (!fs.existsSync(automationsDir)) return [];
    return fs
      .readdirSync(automationsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const automationToml = path.join(automationsDir, entry.name, "automation.toml");
        const raw = fs.existsSync(automationToml) ? fs.readFileSync(automationToml, "utf8") : "";
        const name = raw.match(/^name\s*=\s*"([^"]+)"/m)?.[1] || entry.name;
        const status = raw.match(/^status\s*=\s*"([^"]+)"/m)?.[1] || "UNKNOWN";
        return { id: entry.name, name, status };
      });
  }

  function firstMarkdownHeading(markdown) {
    return String(markdown || "").match(/^#\s+(.+)$/m)?.[1]?.trim() || "";
  }

  function skillDescription(markdown) {
    const frontmatter = String(markdown || "").match(/^---\n([\s\S]*?)\n---/);
    const frontmatterDescription = frontmatter?.[1].match(/^description:\s*(.+)$/m)?.[1]?.trim();
    if (frontmatterDescription) return frontmatterDescription.replace(/^["']|["']$/g, "");
    return firstMarkdownHeading(markdown);
  }

  function readSkillsFrom(rootDir, source) {
    if (!fs.existsSync(rootDir)) return [];
    return fs
      .readdirSync(rootDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const skillFile = path.join(rootDir, entry.name, "SKILL.md");
        if (!fs.existsSync(skillFile)) return null;
        const raw = fs.readFileSync(skillFile, "utf8");
        return {
          name: entry.name,
          description: skillDescription(raw),
          source,
        };
      })
      .filter(Boolean);
  }

  function readSkills(options = {}) {
    const codexHome = env.CODEX_HOME || path.join(os.homedir(), ".codex");
    const codexSkillsDir = Object.prototype.hasOwnProperty.call(options, "codexSkillsDir") ? options.codexSkillsDir : path.join(codexHome, "skills");
    const agentSkillsDir = Object.prototype.hasOwnProperty.call(options, "agentSkillsDir")
      ? options.agentSkillsDir
      : path.join(os.homedir(), ".agents", "skills");
    const roots = [
      { path: codexSkillsDir, source: "codex" },
      { path: agentSkillsDir, source: "agents" },
    ].filter((rootInfo) => rootInfo.path);
    const seen = new Set();
    const skills = [];
    for (const rootInfo of roots) {
      for (const skill of readSkillsFrom(rootInfo.path, rootInfo.source)) {
        if (seen.has(skill.name)) continue;
        seen.add(skill.name);
        skills.push(skill);
      }
    }
    return skills.sort((a, b) => a.name.localeCompare(b.name));
  }

  function saveDataUrlAttachment(attachment) {
    const match = String(attachment.dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;
    const mime = match[1];
    if (!mime.startsWith("image/")) return null;
    fs.mkdirSync(uploadDir, { recursive: true });
    const extension = mime.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "png";
    const safeName = String(attachment.name || "upload")
      .replace(/[^a-z0-9._-]/gi, "-")
      .replace(/-+/g, "-")
      .slice(0, 64);
    const fileName = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${safeName || "image"}.${extension}`;
    const target = path.join(uploadDir, fileName);
    fs.writeFileSync(target, Buffer.from(match[2], "base64"), { mode: 0o600 });
    return {
      input: { type: "localImage", path: target },
      preview: { name: attachment.name || fileName, path: fileName, url: `/api/uploaded?name=${encodeURIComponent(fileName)}` },
    };
  }

  return {
    artifactKindForPath,
    decorateReviewFiles,
    discoverArtifacts,
    discoverWorkspaceEntries,
    isImagePath,
    mimeForPath,
    readAutomations,
    readDirectoryListing,
    readSkills,
    relativeDisplayPath,
    reviewSummary,
    runGit,
    safeDirectoryPath,
    safeOpenPath,
    safePathWithin,
    safeRelativePath,
    safeUploadPath,
    safeWorkdirPath,
    saveDataUrlAttachment,
  };
}

module.exports = {
  createWorkspaceAccess,
};
