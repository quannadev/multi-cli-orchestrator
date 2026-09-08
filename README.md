# quan-claude-plugins

Personal Claude Code plugin marketplace. Currently ships two plugins:

## `prompt-localizer`

A `UserPromptSubmit` hook. When you type a prompt in Vietnamese (or another non-English, diacritic-heavy language), it translates the request to English and adds up to 4 bullet points of missing implementation detail — pulled from an actual scan of the project (`package.json` dependencies, `tsconfig.json`, existing `*auth*`-named files, etc.), not invented. That translated + enriched brief is injected as context alongside your prompt, so Claude (and anything it dispatches to next, like `multi-cli-orchestrator`) has a concrete spec instead of a one-line guess — fewer clarifying questions, less chance of implementing the wrong thing.

**Important limit, stated plainly:** Claude Code's hook API has no way to rewrite the prompt you actually typed — a hook can only *block* a prompt entirely or *add context next to it*. This plugin does the latter. Your Vietnamese text stays exactly as you wrote it in the transcript; what changes is that Claude also sees an English translation + detail brief right next to it. If you ask what "rewrite" means in practice, this is it — nothing fancier than that.

**What triggers it:** a prompt with meaningful non-ASCII content (roughly >15% of its letters, or 3+ non-ASCII letters) and at least 4 words. Short replies ("tiếp tục", "ok") and English prompts are skipped immediately — no LLM call, no added latency for the common case.

**How it translates:** it shells out to a *nested* `claude -p` call (with `--settings '{"disableAllHooks": true}'` so it can never trigger itself recursively) for the actual translation + enrichment. This means: it needs the `claude` CLI on `PATH` (already true inside Claude Code), and it uses your existing Claude subscription/API quota for that extra call — one nested call per non-English prompt that passes the length check. Full behavior lives in [`plugins/prompt-localizer/scripts/prompt-rewriter.js`](./plugins/prompt-localizer/scripts/prompt-rewriter.js), the hook wiring in [`plugins/prompt-localizer/hooks/hooks.json`](./plugins/prompt-localizer/hooks/hooks.json).

**Requirements:** Node.js (bundled with most dev setups already) and the `claude` CLI on `PATH` — no other dependencies, no `npm install` step.

## `multi-cli-orchestrator`

Orchestrate a task across specialized CLI subagents instead of doing everything with one generalist model:

| Role | Handled by |
|---|---|
| Planning, dispatch, integration | Claude itself (Opus) |
| Coding / implementation | [`codex`](https://developers.openai.com/codex) — OpenAI Codex CLI |
| Design / images / icons / vectors | [`agy`](https://antigravity.google/) — Google Antigravity CLI |

Full behavior (dispatch rules, parallel/sequential/fan-out patterns, known `agy` headless gotcha, cross-verification step) lives in [`plugins/multi-cli-orchestrator/skills/multi-cli-orchestrator/SKILL.md`](./plugins/multi-cli-orchestrator/skills/multi-cli-orchestrator/SKILL.md) — that file is what Claude actually reads, this README is just the install/overview layer.

**Trigger:** by design this only activates when you explicitly ask for a multi-agent workflow, or explicitly ask to delegate to `codex`/`agy` — it won't jump in on a plain "fix this bug" or "make me an icon".

**Requirements:** `codex` and `agy` installed and authenticated on `PATH`. Works in Claude Code (or any environment where Claude has direct bash access).

---

## Install

### Option A — Add this as a marketplace (recommended)

From any Claude Code session:

```
/plugin marketplace add <your-github-username>/quan-claude-plugins
/plugin install multi-cli-orchestrator@quan-plugins
/plugin install prompt-localizer@quan-plugins
/reload-plugins
```

(Install either plugin on its own if you only want one of them — they don't depend on each other.)

(`quan-plugins` is the marketplace's internal `name`, not the repo name — it comes from `.claude-plugin/marketplace.json`.)

### Option B — Add straight from the public GitHub URL

Same repo, same command, just the long form if you prefer not to use the `owner/repo` shorthand:

```
/plugin marketplace add https://github.com/<your-github-username>/quan-claude-plugins.git
/plugin install multi-cli-orchestrator@quan-plugins
/plugin install prompt-localizer@quan-plugins
```

### Option C — Local testing before you push

```
/plugin marketplace add ./quan-claude-plugins
/plugin install multi-cli-orchestrator@quan-plugins
/plugin install prompt-localizer@quan-plugins
```

### Verify

```
claude plugin validate .
```

(run from the repo root — checks both `marketplace.json` and the plugin's `plugin.json`/`SKILL.md`)

---

## Updating

After editing a plugin or bumping its `version` in `plugin.json`:

```
git add -A && git commit -m "update <plugin-name>" && git push
```

Existing users refresh with:

```
/plugin marketplace update quan-plugins
```

Note: `version` in `plugin.json` gates updates — bump it on every real change, or omit it entirely so Claude Code tracks the resolved git commit instead.

---

## Repo layout

```
quan-claude-plugins/
├── .claude-plugin/
│   └── marketplace.json                # marketplace catalog (lists both plugins below)
├── plugins/
│   ├── multi-cli-orchestrator/
│   │   ├── .claude-plugin/
│   │   │   └── plugin.json             # plugin metadata
│   │   └── skills/
│   │       └── multi-cli-orchestrator/
│   │           └── SKILL.md            # the actual behavior Claude reads
│   └── prompt-localizer/
│       ├── .claude-plugin/
│       │   └── plugin.json             # plugin metadata
│       ├── hooks/
│       │   └── hooks.json              # wires the script to UserPromptSubmit
│       └── scripts/
│           └── prompt-rewriter.js      # detect language, scan project, translate+enrich
├── LICENSE
└── README.md
```

Adding another plugin later: create `plugins/<new-plugin>/` with the same shape, then add an entry to `.claude-plugin/marketplace.json`'s `plugins` array pointing at `./plugins/<new-plugin>`.
