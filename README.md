# quan-claude-plugins

Personal Claude Code plugin marketplace. It currently publishes one plugin:
`multi-cli-orchestrator`.

## What it includes

### Multi-CLI orchestration skill

The `multi-cli-orchestrator` skill is invoked only when a user explicitly asks
Claude to coordinate a multi-agent workflow or delegate work to `codex` and/or
`agy`.

| Work | Tool |
| --- | --- |
| Plan, dispatch, integration | Claude Code |
| Implementation and tests | `codex` CLI |
| Images, icons, vectors, visual exploration | `agy` CLI |

The skill is intentionally not selected for ordinary single-tool requests.
Its operating guidance is in
[`SKILL.md`](plugins/multi-cli-orchestrator/skills/multi-cli-orchestrator/SKILL.md).

Requirements: `codex` and `agy` must be installed, authenticated, and
available on `PATH` before they can be dispatched.

### Prompt-localizer hook

The plugin also installs a `UserPromptSubmit` hook. For prompts with at least
four words and meaningful non-ASCII letter content, it adds an English
translation plus up to four project-grounded implementation notes as
`additionalContext`. The original prompt remains unchanged.

The hook skips English and short prompts. It also skips prompts longer than
6,000 characters, malformed hook input, unavailable Claude CLI, or any failed
nested call. A hook failure never blocks the user's prompt.

The hook scans only lightweight project signals before translation:

- `package.json` dependencies
- `tsconfig.json` presence
- Up to eight paths with `auth` in the filename, within four directory levels

For an eligible prompt, the hook makes one nested `claude -p` request. That
request runs in safe mode with no tools, no session persistence, and no user or
project customizations. Its output is parsed, normalized, and length-limited
before it is added to the parent conversation.

This incurs one additional Claude request and sends the eligible prompt plus
the listed project signals to Claude. Install the plugin only where that tradeoff
is acceptable.

Requirements: Node.js and the `claude` CLI on `PATH`. No package installation
is needed.

## Install

Add the marketplace and install the plugin from a Claude Code session:

```text
/plugin marketplace add <github-owner>/quan-claude-plugins
/plugin install multi-cli-orchestrator@quan-plugins
/reload-plugins
```

For local development:

```text
/plugin marketplace add /absolute/path/to/quan-claude-plugins
/plugin install multi-cli-orchestrator@quan-plugins
```

The skill and hook are distributed together. To use only the skill in a local
copy, remove `plugins/multi-cli-orchestrator/hooks/hooks.json` before adding the
marketplace.

## Validate

From the repository root:

```bash
claude plugin validate .
node --check plugins/multi-cli-orchestrator/scripts/prompt-rewriter.js
```

## Update

After a plugin change, bump the version in
`plugins/multi-cli-orchestrator/.claude-plugin/plugin.json`, commit, and push.
Then update the marketplace from Claude Code:

```text
/plugin marketplace update quan-plugins
```

## Layout

```text
quan-claude-plugins/
├── .claude-plugin/marketplace.json
├── plugins/multi-cli-orchestrator/
│   ├── .claude-plugin/plugin.json
│   ├── hooks/hooks.json
│   ├── scripts/prompt-rewriter.js
│   └── skills/multi-cli-orchestrator/SKILL.md
├── LICENSE
└── README.md
```

To add another plugin, create its own directory under `plugins/` with a
`.claude-plugin/plugin.json`, then add it to the `plugins` array in
`.claude-plugin/marketplace.json`.
