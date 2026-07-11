#!/usr/bin/env node
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
