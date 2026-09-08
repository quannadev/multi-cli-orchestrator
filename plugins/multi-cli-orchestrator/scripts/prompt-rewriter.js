#!/usr/bin/env node
"use strict";
/**
 * UserPromptSubmit hook — prompt-localizer
 *
 * What this does, and what it deliberately does NOT do:
 *   - Claude Code's UserPromptSubmit hook can only ADD context alongside the
 *     prompt the user typed, or BLOCK it entirely (which erases it). There is
 *     no way for a hook to rewrite the visible prompt in place. So instead of
 *     pretending to "translate the prompt", this hook detects non-English
 *     input, translates + enriches it into an English brief, and injects
 *     that brief as additionalContext next to the original prompt. Claude
 *     reads both; the user's own words stay untouched in the transcript.
 *
 * Flow:
 *   1. Fast, dependency-free heuristic: does this look non-English, and is
 *      it long enough to be a real task (not "ok" / "tiếp tục")? If not,
 *      exit immediately — no LLM call, no added latency, the common case
 *      (English prompts, short replies) is untouched.
 *   2. Deterministically scan the project (package.json, tsconfig, existing
 *      *auth* files, etc.) — no LLM needed for this part, just file reads.
 *   3. Make ONE nested `claude -p` call with the prompt + project signals,
 *      asking it to translate and add only well-grounded missing detail.
 *      Hooks are disabled for that nested call (--settings
 *      '{"disableAllHooks": true}') plus an env-var guard, so it can never
 *      recursively trigger this same hook.
 *   4. On any failure, fail open: print nothing, exit 0. A broken hook must
 *      never block the user's actual prompt.
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const MIN_WORDS = 4; // below this, treat as a short reply, not a task
const NON_ASCII_RATIO_THRESHOLD = 0.15;
const NON_ASCII_COUNT_THRESHOLD = 3;
const MAX_FILE_HITS = 8;
const MAX_SCAN_DEPTH = 4;
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", ".turbo", "out", "coverage"]);
const NESTED_CALL_TIMEOUT_MS = 25000;

function main() {
  // Belt-and-suspenders recursion guard. The primary guard is
  // --settings '{"disableAllHooks": true}' on the nested call below.
  if (process.env.CLAUDE_HOOK_NO_RECURSE === "1") process.exit(0);

  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(0, "utf8"));
  } catch (e) {
    process.stderr.write(`prompt-localizer: bad JSON input (${e}), skipping\n`);
    process.exit(0);
  }

  const prompt = payload.prompt || "";
  const cwd = payload.cwd || process.cwd();

  if (!shouldEnrich(prompt)) process.exit(0);

  if (!hasClaudeCli()) {
    process.stderr.write("prompt-localizer: 'claude' CLI not found on PATH, skipping\n");
    process.exit(0);
  }

  const projectBrief = gatherProjectSignals(cwd);
  const enriched = translateAndEnrich(prompt, projectBrief);
  if (!enriched) process.exit(0); // fail open

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: enriched,
      },
    })
  );
  process.exit(0);
}

function shouldEnrich(text) {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.split(/\s+/).length < MIN_WORDS) return false; // short reply, skip
  const letters = [...trimmed].filter((c) => /\p{L}/u.test(c));
  if (letters.length === 0) return false;
  const nonAscii = letters.filter((c) => c.codePointAt(0) > 127);
  const ratio = nonAscii.length / letters.length;
  return ratio > NON_ASCII_RATIO_THRESHOLD || nonAscii.length >= NON_ASCII_COUNT_THRESHOLD;
}

function hasClaudeCli() {
  const probe = spawnSync("claude", ["--version"], { stdio: "ignore", timeout: 5000 });
  return !probe.error;
}

function safeReadJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function gatherProjectSignals(cwd) {
  const lines = [];

  const pkg = safeReadJson(path.join(cwd, "package.json"));
  if (pkg) {
    const deps = Object.assign({}, pkg.dependencies, pkg.devDependencies);
    const pick = (names) => names.filter((n) => deps[n]);
    const frameworks = pick(["react", "vue", "next", "svelte", "express", "fastify", "@nestjs/core"]);
    const stateLibs = pick(["redux", "@reduxjs/toolkit", "zustand", "jotai", "recoil", "mobx", "@tanstack/react-query", "swr"]);
    const authLibs = pick(["next-auth", "@auth/core", "passport", "firebase", "@supabase/supabase-js", "@clerk/nextjs", "auth0"]);
    if (frameworks.length) lines.push(`Frameworks in package.json: ${frameworks.join(", ")}`);
    if (stateLibs.length) lines.push(`State management libs present: ${stateLibs.join(", ")}`);
    if (authLibs.length) lines.push(`Auth libs present: ${authLibs.join(", ")}`);
    if (deps.typescript || fs.existsSync(path.join(cwd, "tsconfig.json"))) {
      lines.push("Project uses TypeScript");
    }
  }

  const hits = [];
  (function walk(dir, depth) {
    if (hits.length >= MAX_FILE_HITS || depth > MAX_SCAN_DEPTH) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (hits.length >= MAX_FILE_HITS) return;
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(path.join(dir, entry.name), depth + 1);
      } else if (/auth/i.test(entry.name)) {
        hits.push(path.relative(cwd, path.join(dir, entry.name)));
      }
    }
  })(cwd, 0);
  if (hits.length) lines.push(`Existing auth-related files: ${hits.join(", ")}`);

  return lines.join("\n");
}

function translateAndEnrich(prompt, projectBrief) {
  const instruction = `You are a prompt-rewriting step inside a coding assistant's pipeline, not a conversational reply. A developer just typed a request in a non-English language, inside a project with the context below.

Do exactly two things and nothing else:
1. Translate the request into clear, natural English.
2. Add up to 4 short bullet points filling in implementation details the request left implicit (state approach, likely files/folders, naming, edge cases) — but ONLY using what the project context actually supports. If the context doesn't tell you something, note it as an open question instead of guessing.

Output ONLY the result, in this exact shape, no preamble, no markdown headers:
English request: <the translated request, one line>
Details:
- <bullet>
- <bullet>

Project context:
${projectBrief || "(no project signals detected)"}

Original request:
${prompt}
`;

  const res = spawnSync(
    "claude",
    ["-p", "--settings", '{"disableAllHooks": true}', instruction],
    {
      encoding: "utf8",
      timeout: NESTED_CALL_TIMEOUT_MS,
      env: Object.assign({}, process.env, { CLAUDE_HOOK_NO_RECURSE: "1" }),
    }
  );

  if (res.error || res.status !== 0) {
    const detail = res.error ? res.error.message : (res.stderr || "").slice(0, 300);
    process.stderr.write(`prompt-localizer: nested claude call failed: ${detail}\n`);
    return "";
  }
  return (res.stdout || "").trim();
}

main();
