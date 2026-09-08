---
name: multi-cli-orchestrator
description: Coordinate explicitly requested multi-CLI work by routing implementation to codex and visual assets to agy. Use when the user asks for multi-agent orchestration or names these CLIs; do not use for ordinary single-agent work.
---

# Multi-CLI Agent Orchestrator

Use this skill only after an explicit request to coordinate these CLIs. Claude owns
task decomposition, dispatch decisions, integration, and the final user-facing
result; the CLIs own narrowly scoped outputs.

## Preconditions

Confirm both commands are available before dispatching. Check each CLI's help
before relying on non-interactive flags because installed versions may differ.

```bash
command -v codex && codex --version
command -v agy && agy --version
codex exec --help
agy --help
```

If a required CLI is unavailable or unauthenticated, report that fact and do
not invent installation or authentication instructions.

## Route Work

- Keep planning, architecture, acceptance criteria, and integration in Claude.
- Send implementation, repository edits, and test work to `codex`.
- Send image, icon, vector, and visual-exploration work to `agy`.
- Keep a task in Claude when it does not benefit from delegation.

Create a short plan before dispatch: owner, expected output, relevant paths,
acceptance criteria, and dependencies. Do not let two agents edit the same file
in parallel. Dispatch independent work in parallel; dispatch dependent work
only after the upstream output has a stable path or interface.

## Dispatch

Give each CLI a self-contained request. Include the scope, relevant files,
expected deliverable, verification command, and any artifact produced by the
other CLI.

```bash
codex exec "Implement the agreed request in src/api/users. Add focused tests and run them."
```

Use the installed `agy --help` output to select its current non-interactive
command. Capture or persist its asset at a stable path before passing that path
to `codex`.

## Integrate

Inspect each result against the plan, resolve overlaps, wire assets into code,
and run the relevant validation. For high-risk work, ask the other CLI for a
narrow independent check only when it can materially validate the result.

Report the integrated outcome rather than forwarding raw CLI logs.
