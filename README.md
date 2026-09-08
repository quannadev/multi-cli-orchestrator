# quan-claude-plugins

Personal Claude Code plugin marketplace. Currently ships one plugin:

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
/reload-plugins
```

(`quan-plugins` is the marketplace's internal `name`, not the repo name — it comes from `.claude-plugin/marketplace.json`.)

### Option B — Add straight from the public GitHub URL

Same repo, same command, just the long form if you prefer not to use the `owner/repo` shorthand:

```
/plugin marketplace add https://github.com/<your-github-username>/quan-claude-plugins.git
/plugin install multi-cli-orchestrator@quan-plugins
```

### Option C — Local testing before you push

```
/plugin marketplace add ./quan-claude-plugins
/plugin install multi-cli-orchestrator@quan-plugins
```

### Verify

```
claude plugin validate .
```

(run from the repo root — checks both `marketplace.json` and the plugin's `plugin.json`/`SKILL.md`)

---

## Updating

After editing the skill or bumping `version` in `plugin.json`:

```
git add -A && git commit -m "update multi-cli-orchestrator" && git push
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
│   └── marketplace.json                # marketplace catalog (lists the plugin(s) below)
├── plugins/
│   └── multi-cli-orchestrator/
│       ├── .claude-plugin/
│       │   └── plugin.json             # plugin metadata
│       └── skills/
│           └── multi-cli-orchestrator/
│               └── SKILL.md            # the actual behavior Claude reads
├── LICENSE
└── README.md
```

Adding a second plugin later: create `plugins/<new-plugin>/` with the same shape, then add an entry to `.claude-plugin/marketplace.json`'s `plugins` array pointing at `./plugins/<new-plugin>`.
