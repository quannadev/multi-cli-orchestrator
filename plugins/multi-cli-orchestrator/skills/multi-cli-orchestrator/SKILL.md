---
name: multi-cli-orchestrator
description: Orchestrate a task across specialized CLI subagents instead of doing everything as one generalist model — delegate coding/implementation to the `codex` CLI (OpenAI Codex) and design/image/icon/vector work to the `agy` CLI (Google Antigravity), while Claude itself (running as Opus) handles planning, dispatch, and integration. Use this skill when the user explicitly asks for a "multi-agent" workflow, explicitly asks to delegate/dispatch to `codex` and/or `agy`, references the planner+codex+agy split by name, or asks Claude to orchestrate CLI subagents for a task. Do NOT trigger this for a plain single-tool ask like "fix this bug" or "make me an icon" — only use it when the user has explicitly asked for the multi-agent split, not just because a task happens to involve both code and design.
compatibility: Requires a shell (bash) with both `codex` (OpenAI Codex CLI) and `agy` (Google Antigravity CLI) installed and authenticated on PATH. Built for Claude Code or another environment where Claude has direct bash access.
---

# Multi-CLI Agent Orchestrator

## Why this split

Each tool is genuinely better at a different slice of the work, and routing tasks to whichever one is actually good at them beats making a single generalist do everything:

- **Planning & integration — you, running as Opus.** You already have the full conversation, the user's actual intent, and direct read/write access to the repo. Do the breakdown, the architectural calls, and the final review yourself. Don't burn a subprocess call on this — it's the one job you're already best positioned for.
- **Coding & implementation — `codex`.** OpenAI's Codex CLI is the strongest of the three at multi-file code changes, running tests, and iterating on a real repo.
- **Design, images, icons, vectors — `agy`.** Google's Antigravity CLI (binary name `agy`) ships a built-in image-generation tool and is the better choice for mockups, icon sets, illustrations, and other visual assets.

This is the same split other multi-CLI orchestration projects converge on independently (e.g. Claw Orchestrator wraps Claude Code, Codex, and Antigravity as interchangeable "engines" behind Planner/Coder/Reviewer and consensus-voting patterns) — it's a proven division of labor, not a one-off guess.

## Step 1 — Plan it yourself first

Before touching either CLI, break the task into a short list of subtasks and tag each one `plan` (you keep it), `design` (→ agy), or `code` (→ codex). Note dependencies explicitly — e.g. "the codex task needs the icon agy produces" means the design subtask has to at least produce a stable file path before the codex prompt that references it goes out.

Show this plan to the user before dispatching anything. It's the cheapest point to catch a wrong decomposition, and it doubles as your integration checklist in Step 6.

If a subtask genuinely doesn't split cleanly into "design" or "code" — see the fan-out option in Step 5 instead of forcing a guess here.

## Step 2 — Confirm both CLIs are actually usable

Don't assume — check first, since both tools' flags and auth requirements have been changing fast:

```bash
command -v codex && codex --version
command -v agy && agy --version
```

If either is missing, tell the user and stop rather than guessing at install steps for them — install methods (npm/homebrew for codex, a shell installer for agy) and current auth flows drift, so stale instructions from memory would waste their time more than just naming the gap.

If both are present, it's worth a quick `codex exec --help` / `agy --help` once per session before leaning on a specific flag — don't assume a flag from this skill still matches the installed version; confirm it.

## Step 3 — Dispatch to codex (coding/implementation)

Codex's non-interactive entry point is `codex exec`:

```bash
codex exec "implement the /api/users endpoint per plan.md, add tests"
```

Useful flags to know about (verify against `--help` for the installed version):
- `--json` — structured stdout, easier to parse programmatically
- `-o result.txt` — write the final response to a file instead of stdout
- `--model <name>` — pick the model for this run
- `--full-auto` — let codex edit files and run commands without per-step approval; only use this in a sandbox or scratch branch you actually trust, since it removes the approval checkpoint

Give codex a self-contained prompt: point it at the relevant files or directory, state the acceptance criteria, and if a design subtask already ran, mention the asset path(s) it should consume.

## Step 4 — Dispatch to agy (design/image/icon/vector)

Agy's non-interactive flag is `-p`:

```bash
agy -p "generate a flat-style SVG icon for a 'sync' action, save to assets/icons/sync.svg"
```

**Known gotcha:** several agy versions hang, or silently return empty output, when stdout isn't a real terminal — which is exactly the subprocess situation you're calling it from. This is a tracked upstream issue, not a sign you did something wrong. Guard against it instead of retrying blindly:

1. Run with a timeout and capture to a file: `timeout 60 agy -p "..." > /tmp/agy_out.txt 2>&1`
2. Check the file afterward. Empty output with a clean exit code is the known bug, not "agy had nothing to say."
3. If it keeps failing, don't loop on the same call — tell the user headless agy isn't returning output on this machine, and offer to do the design step yourself (a written spec, or an SVG you hand-author) so the task doesn't stay blocked on a flaky subprocess.

If the user has a Claude Code plugin wrapping agy (e.g. one that exposes `/agy:image` or `/agy:delegate`), prefer that over raw `agy -p` — such plugins typically already work around the issue above.

## Step 5 — Parallel vs. sequential vs. fan-out dispatch

**Parallel**, when subtasks are genuinely independent:

```bash
timeout 60 agy -p "..." > /tmp/design_out.txt 2>&1 &
codex exec "..." > /tmp/code_out.txt &
wait
```

**Sequential**, when one depends on the other's output — most commonly, agy produces an asset or spec first, and the codex prompt is written to reference that resulting file path.

**Fan-out (council-style)**, when the split itself is unclear. Some tasks don't cleanly divide into "design" or "code" — e.g. "make this settings page feel more polished" could go either way. Rather than force a guess in Step 1, send the same prompt to both CLIs in parallel and compare what comes back yourself, picking or merging the better result:

```bash
timeout 60 agy -p "<same task description>" > /tmp/agy_take.txt 2>&1 &
codex exec "<same task description>" > /tmp/codex_take.txt &
wait
```

This costs one extra parallel call, but it's cheaper than committing to the wrong tool and redoing the work.

## Step 6 — Integrate and review

Once results return, you do the integration pass, not another subprocess: read what each produced, check it against the plan from Step 1, wire design assets into the code if that didn't happen automatically, and re-dispatch a narrower follow-up to whichever CLI needs it if something's off. Report the outcome against the original plan — the user asked you to orchestrate, not to relay two raw logs.

## Step 7 — Optional: cross-check high-stakes pieces

For a subtask where getting it wrong is expensive — an icon that has to match a brand pixel-for-pixel, or a code change touching auth — spend one more round: hand one CLI's output to the *other* CLI and ask it to check for problems in its own domain. For example, ask codex to verify the SVG agy produced actually parses and renders at the sizes the code expects, or ask agy for a second opinion on whether a generated icon matches the brief that codex's UI code assumes.

Skip this for routine work — it roughly doubles the CLI calls for that subtask, so reserve it for pieces where a mistake would actually cost something.

## Troubleshooting

- **Neither CLI is installed** — tell the user; don't quietly fall back to doing everything yourself unless they ask you to.
- **codex hangs waiting for approval** — you likely didn't pass `--full-auto` or the current non-interactive approval flag; check `codex exec --help` for the exact name on this version.
- **agy's silent-output bug persists after the timeout/retry pattern in Step 4** — check whether a pty-wrapping helper is installed for headless agy on this machine; if not, fall back to doing the design step yourself rather than spending more attempts on a call that reliably returns nothing.
- **codex and agy both touch the same file** — resolve it by hand during Step 6; don't let them write to the same target path in parallel.
