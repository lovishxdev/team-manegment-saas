/**
 * The ambient-memory hook and its one-command installers.
 *
 * One hook script serves every supported agent — the payloads differ only
 * in field names ("stop"/conversation_id/workspace_roots for Cursor,
 * "Stop"/session_id/cwd for Claude Code). It rides the agent's
 * end-of-run event: reads the transcript the agent already keeps on disk
 * (nothing intercepted mid-session), extracts just user/agent message
 * text, and POSTs the delta since the last run to
 * /api/ingest/agent-session. The response carries the fresh workspace
 * brief, written where that agent auto-loads context:
 *   - Cursor:      .cursor/rules/euclis-memory.mdc (alwaysApply)
 *   - Claude Code: .claude/euclis-memory.md, imported from CLAUDE.md via
 *                  an "@" line (added once by the installer) so the
 *                  committed CLAUDE.md never churns
 *
 * Served by /api/agent-hooks as a bash installer:
 *   curl -fsSL "<origin>/api/agent-hooks?agent=cursor"      | bash -s -- <token>
 *   curl -fsSL "<origin>/api/agent-hooks?agent=claude-code" | bash -s -- <token>
 */

export type HookAgent = "cursor" | "claude-code";

export const HOOK_AGENTS: readonly HookAgent[] = ["cursor", "claude-code"];

export function normalizeHookAgent(value: string | null): HookAgent {
  return value === "claude-code" ? "claude-code" : "cursor";
}

/** Self-contained Node script (no deps, Node 18+). No `${}`/backticks — safe in String.raw. */
export const AGENT_MEMORY_HOOK_SCRIPT = String.raw`#!/usr/bin/env node
// Euclis ambient memory hook (Cursor "stop" / Claude Code "Stop" event).
// Ships the session transcript delta to Euclis for post-hoc memory capture
// and refreshes the project brief. Never blocks the agent; fails silent.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

var MIN_DELTA_CHARS = 300;
var MAX_DELTA_CHARS = 24000;
var MAX_BLOCK_CHARS = 3000;
var MAX_DOCUMENTS = 12;
var MAX_DOCUMENT_CHARS = 8000;
var MAX_DOCUMENT_TOTAL_CHARS = 48000;

function readStdin() {
  return new Promise(function (resolve) {
    var data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", function (c) { data += c; });
    process.stdin.on("end", function () { resolve(data); });
    setTimeout(function () { resolve(data); }, 3000);
  });
}

// Cursor and Claude Code send the same idea with different field names.
// canAsk: whether this run may feed a follow-up back into the session
// (guarded against loops — a follow-up run never asks again).
function detectAgent(input) {
  if (input.hook_event_name === "stop") {
    return {
      agent: "cursor",
      root:
        (Array.isArray(input.workspace_roots) && input.workspace_roots[0]) ||
        process.cwd(),
      conversationId: input.conversation_id || "unknown",
      canAsk: !(input.loop_count > 0),
    };
  }
  if (input.hook_event_name === "Stop") {
    return {
      agent: "claude-code",
      root: input.cwd || process.cwd(),
      conversationId: input.session_id || "unknown",
      canAsk: input.stop_hook_active !== true,
    };
  }
  return null;
}

function loadConfig(root) {
  if (process.env.EUCLIS_URL && process.env.EUCLIS_TOKEN) {
    return { url: process.env.EUCLIS_URL, token: process.env.EUCLIS_TOKEN };
  }
  var candidates = [
    join(root, ".euclis.json"),
    join(root, ".cursor", "euclis.json"),
  ];
  for (var i = 0; i < candidates.length; i++) {
    try {
      var raw = JSON.parse(readFileSync(candidates[i], "utf8"));
      if (raw && raw.url && raw.token) return { url: raw.url, token: raw.token };
    } catch (e) {}
  }
  return null;
}

function expandHome(p) {
  if (typeof p === "string" && p.slice(0, 2) === "~/") {
    return join(homedir(), p.slice(2));
  }
  return p;
}

// Works for both transcript shapes:
//  - Cursor:      {"role":"user","message":{"content":[{type:"text",...}]}}
//  - Claude Code: {"type":"assistant","message":{"role":"assistant","content":[...]}}
//    (user content is sometimes a plain string; sidechains are subagents)
function extractText(lines, fromLine) {
  var parts = [];
  for (var i = fromLine; i < lines.length; i++) {
    var obj;
    try { obj = JSON.parse(lines[i]); } catch (e) { continue; }
    if (!obj || obj.isSidechain === true) continue;
    var role = obj.role || obj.type;
    if (role !== "user" && role !== "assistant") continue;
    var content = obj.message && obj.message.content;
    var blocks = Array.isArray(content)
      ? content
      : typeof content === "string"
        ? [{ type: "text", text: content }]
        : [];
    for (var j = 0; j < blocks.length; j++) {
      var block = blocks[j];
      if (!block || block.type !== "text" || typeof block.text !== "string") continue;
      var text = block.text.trim();
      if (!text) continue;
      if (text.length > MAX_BLOCK_CHARS) text = text.slice(0, MAX_BLOCK_CHARS) + " [...]";
      parts.push((role === "user" ? "User: " : "Agent: ") + text);
    }
  }
  return parts.join("\n\n");
}

function writeBrief(agent, root, brief) {
  if (agent === "cursor") {
    var rulesDir = join(root, ".cursor", "rules");
    mkdirSync(rulesDir, { recursive: true });
    writeFileSync(
      join(rulesDir, "euclis-memory.mdc"),
      "---\nalwaysApply: true\n---\n\n" + brief + "\n"
    );
    return;
  }
  // Claude Code: generated file imported from CLAUDE.md (installer adds the
  // "@.claude/euclis-memory.md" line once), so the committed file is stable.
  var claudeDir = join(root, ".claude");
  mkdirSync(claudeDir, { recursive: true });
  writeFileSync(join(claudeDir, "euclis-memory.md"), brief + "\n");
}

// Markdown is useful evidence the transcript may only mention briefly (ADRs,
// architecture notes, implementation plans, README/docs changed by the
// agent). Only changed/untracked files are considered; generated agent
// context/instruction files are always excluded.
function gitLines(root, args) {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 1024 * 1024,
    }).split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
  } catch (e) {
    return [];
  }
}

function collectMarkdown(root, previousHashes) {
  var paths = [];
  var commands = [
    ["diff", "--name-only", "--diff-filter=AM", "--", "*.md"],
    ["diff", "--cached", "--name-only", "--diff-filter=AM", "--", "*.md"],
    ["ls-files", "--others", "--exclude-standard", "--", "*.md"],
    // Gradually backfill existing tracked Markdown too. Repo-level hashes
    // mean unchanged files are sent once across all conversations, not once
    // per chat; the 12-file cap spreads large repos over several runs.
    ["ls-files", "--", "*.md"],
  ];
  for (var i = 0; i < commands.length; i++) {
    var found = gitLines(root, commands[i]);
    for (var j = 0; j < found.length; j++) {
      if (paths.indexOf(found[j]) === -1) paths.push(found[j]);
    }
  }

  var documents = [];
  var nextHashes = Object.assign({}, previousHashes || {});
  var totalChars = 0;
  for (var k = 0; k < paths.length && documents.length < MAX_DOCUMENTS; k++) {
    var relative = paths[k].replace(/\\/g, "/");
    if (
      relative === "AGENTS.md" ||
      relative === "CLAUDE.md" ||
      relative.slice(0, 8) === ".cursor/" ||
      relative.slice(0, 8) === ".claude/" ||
      relative.slice(0, 13) === "node_modules/" ||
      relative.slice(0, 5) === ".git/" ||
      relative.indexOf("../") !== -1 ||
      !/\.md$/i.test(relative)
    ) {
      continue;
    }
    try {
      var content = readFileSync(join(root, relative), "utf8").trim();
      if (!content) continue;
      if (
        /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(content) ||
        /\b(?:sk-ant-|sk-proj-|ghp_|github_pat_|AKIA)[A-Za-z0-9_-]{16,}/.test(content)
      ) {
        continue;
      }
      var fullHash = createHash("sha256").update(content).digest("hex");
      nextHashes[relative] = fullHash;
      if (previousHashes && previousHashes[relative] === fullHash) continue;
      if (content.length > MAX_DOCUMENT_CHARS) {
        content = content.slice(0, MAX_DOCUMENT_CHARS) + "\n\n[...document truncated by Euclis hook]";
      }
      if (totalChars + content.length > MAX_DOCUMENT_TOTAL_CHARS) break;
      totalChars += content.length;
      var snapshotHash = createHash("sha256").update(content).digest("hex");
      documents.push({ path: relative, hash: snapshotHash, content: content });
    } catch (e) {}
  }
  return { documents: documents, hashes: nextHashes };
}

async function main() {
  var input = JSON.parse(await readStdin());
  var detected = detectAgent(input);
  if (!detected) return;
  var config = loadConfig(detected.root);
  if (!config) return;

  var transcriptPath = expandHome(input.transcript_path);
  if (!transcriptPath || !existsSync(transcriptPath)) return;

  var lines = readFileSync(transcriptPath, "utf8").split("\n");
  var stateDir = join(homedir(), ".euclis", "state");
  var statePath = join(stateDir, detected.conversationId + ".json");
  var repoStateKey = createHash("sha256")
    .update(detected.root)
    .digest("hex")
    .slice(0, 20);
  var documentStatePath = join(stateDir, "documents-" + repoStateKey + ".json");
  var state = {};
  var documentState = {};
  var fromLine = 0;
  try { state = JSON.parse(readFileSync(statePath, "utf8")) || {}; } catch (e) {}
  try { documentState = JSON.parse(readFileSync(documentStatePath, "utf8")) || {}; } catch (e) {}
  fromLine = state.line || 0;
  if (fromLine > lines.length) fromLine = 0;

  var delta = extractText(lines, fromLine);
  var markdown = collectMarkdown(detected.root, documentState.hashes || {});
  // Too little new material: keep the old offset so it accumulates into the
  // next run instead of being dropped. Changed Markdown can independently
  // trigger capture even when the transcript delta is short.
  if (delta.length < MIN_DELTA_CHARS && markdown.documents.length === 0) return;
  if (delta.length > MAX_DELTA_CHARS) delta = delta.slice(-MAX_DELTA_CHARS);

  var base = config.url.replace(/\/+$/, "");
  var res = await fetch(base + "/api/ingest/agent-session", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer " + config.token,
    },
    body: JSON.stringify({
      conversation_id: detected.conversationId,
      transcript: delta,
      documents: markdown.documents,
      synthetic: !detected.canAsk,
    }),
    // The judge runs inline server-side; give it room.
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) return;

  mkdirSync(stateDir, { recursive: true });
  writeFileSync(
    statePath,
    JSON.stringify({ line: lines.length })
  );
  writeFileSync(
    documentStatePath,
    JSON.stringify({ hashes: markdown.hashes })
  );

  var data = null;
  try { data = await res.json(); } catch (e) {}
  if (data && typeof data.brief === "string" && data.brief.trim()) {
    writeBrief(detected.agent, detected.root, data.brief);
  }

  // Confirm-only resolution ask: feed it back into the session so the
  // agent asks the user right in the editor. Loop-guarded via canAsk and
  // server-side per-event throttles.
  var ask =
    data && typeof data.ask === "string" && data.ask.trim()
      ? data.ask.trim()
      : null;
  if (ask && detected.canAsk) {
    if (detected.agent === "cursor") {
      process.stdout.write(JSON.stringify({ followup_message: ask }));
    } else {
      process.stdout.write(JSON.stringify({ decision: "block", reason: ask }));
    }
  }
}

main().catch(function () {}).finally(function () { process.exit(0); });
`;

const CLAUDE_IMPORT_LINE = "@.claude/euclis-memory.md";

/**
 * Bash installer served by /api/agent-hooks. Built line-by-line (not a
 * template literal) because bash parameter expansion uses the same
 * ${...} syntax as JS interpolation.
 */
export function buildAgentHooksInstaller(
  origin: string,
  agent: HookAgent
): string {
  const hookDir = agent === "cursor" ? ".cursor/hooks" : ".claude/hooks";
  const hookPath = hookDir + "/euclis-memory.mjs";
  const hookCmd = "node " + hookPath;

  const header: string[] = [
    "#!/bin/bash",
    "# Euclis ambient memory - " +
      (agent === "cursor" ? "Cursor" : "Claude Code") +
      " hook installer.",
    "# Usage: curl -fsSL \"" +
      origin +
      "/api/agent-hooks?agent=" +
      agent +
      '" | bash -s -- <euclis-token>',
    "set -euo pipefail",
    "",
    'TOKEN="${1:-${EUCLIS_TOKEN:-}}"',
    'ORIGIN="' + origin + '"',
    "",
    "if ! command -v node >/dev/null 2>&1; then",
    '  echo "The Euclis memory hook needs node on PATH." >&2',
    "  exit 1",
    "fi",
    "",
    "mkdir -p " + hookDir,
    "",
    "cat > " + hookPath + " <<'EUCLIS_HOOK_EOF'",
    AGENT_MEMORY_HOOK_SCRIPT.trimEnd(),
    "EUCLIS_HOOK_EOF",
    "chmod +x " + hookPath,
    "",
  ];

  const register: string[] =
    agent === "cursor"
      ? [
          "# Register the stop hook, preserving any existing hooks.json entries.",
          "node - <<'EUCLIS_MERGE_EOF'",
          'const fs = require("fs");',
          'const path = ".cursor/hooks.json";',
          "let cfg = {};",
          'try { cfg = JSON.parse(fs.readFileSync(path, "utf8")); } catch {}',
          'if (typeof cfg !== "object" || cfg === null) cfg = {};',
          "cfg.version = cfg.version || 1;",
          "cfg.hooks = cfg.hooks || {};",
          "cfg.hooks.stop = cfg.hooks.stop || [];",
          'const cmd = "' + hookCmd + '";',
          "if (!cfg.hooks.stop.some((h) => h && h.command === cmd)) {",
          "  cfg.hooks.stop.push({ command: cmd, timeout: 60 });",
          "}",
          'fs.writeFileSync(path, JSON.stringify(cfg, null, 2) + "\\n");',
          "EUCLIS_MERGE_EOF",
        ]
      : [
          "# Register the Stop hook in .claude/settings.json, preserving",
          "# existing hooks, and make CLAUDE.md import the generated brief.",
          "node - <<'EUCLIS_MERGE_EOF'",
          'const fs = require("fs");',
          'const path = ".claude/settings.json";',
          "let cfg = {};",
          'try { cfg = JSON.parse(fs.readFileSync(path, "utf8")); } catch {}',
          'if (typeof cfg !== "object" || cfg === null) cfg = {};',
          "cfg.hooks = cfg.hooks || {};",
          "cfg.hooks.Stop = cfg.hooks.Stop || [];",
          'const cmd = "' + hookCmd + '";',
          "const has = cfg.hooks.Stop.some(",
          "  (m) => m && Array.isArray(m.hooks) && m.hooks.some((h) => h && h.command === cmd)",
          ");",
          "if (!has) {",
          '  cfg.hooks.Stop.push({ hooks: [{ type: "command", command: cmd, timeout: 60 }] });',
          "}",
          'fs.writeFileSync(path, JSON.stringify(cfg, null, 2) + "\\n");',
          "",
          'const importLine = "' + CLAUDE_IMPORT_LINE + '";',
          'let claudeMd = "";',
          'try { claudeMd = fs.readFileSync("CLAUDE.md", "utf8"); } catch {}',
          "if (!claudeMd.includes(importLine)) {",
          "  const header = claudeMd.trim().length > 0 ? claudeMd.replace(/\\s*$/, \"\\n\\n\") : \"\";",
          "  fs.writeFileSync(",
          '    "CLAUDE.md",',
          '    header + "# Euclis project memory (auto-generated brief)\\n" + importLine + "\\n"',
          "  );",
          "}",
          "EUCLIS_MERGE_EOF",
        ];

  const footer: string[] = [
    "",
    'if [ -n "$TOKEN" ]; then',
    "  printf '{\\n  \"url\": \"%s\",\\n  \"token\": \"%s\"\\n}\\n' \"$ORIGIN\" \"$TOKEN\" > .euclis.json",
    "else",
    '  echo "No token given. Create .euclis.json with:"',
    '  echo "  { \\"url\\": \\"$ORIGIN\\", \\"token\\": \\"<your Euclis personal token>\\" }"',
    "fi",
    "",
    "touch .gitignore",
    "if ! grep -qxF '.euclis.json' .gitignore 2>/dev/null; then",
    "  printf '\\n# Euclis (local credential + generated memory briefs)\\n.euclis.json\\n.cursor/euclis.json\\n.cursor/rules/euclis-memory.mdc\\n.claude/euclis-memory.md\\n' >> .gitignore",
    "fi",
    "",
    'echo ""',
    'echo "Euclis memory hook installed:"',
    'echo "  ' + hookPath + '   runs after each agent session"',
    agent === "cursor"
      ? 'echo "  .cursor/hooks.json                stop hook registered"'
      : 'echo "  .claude/settings.json             Stop hook registered"',
    agent === "cursor"
      ? 'echo "After the next agent run, the live project brief will appear at"'
      : 'echo "After the next session, the live project brief will appear at"',
    agent === "cursor"
      ? 'echo ".cursor/rules/euclis-memory.mdc and load into every new session."'
      : 'echo ".claude/euclis-memory.md (imported by CLAUDE.md) and load into every new session."',
  ];

  return [...header, ...register, ...footer].join("\n") + "\n";
}
