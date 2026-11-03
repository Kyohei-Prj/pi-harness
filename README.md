# pi-harness

Version-controlled configuration for the [Pi coding agent](https://pi.dev/), plus
the working method that configuration exists to support. `agent/` mirrors the user-level agent
directory (by default `~/.pi/agent`) and holds only the files that describe *how Pi should behave* —
no credentials, no installs, no chat history.

## Repository layout

| Path | What it is |
|---|---|
| `agent/` | Mirror of the live Pi agent directory — see the table below |
| `AGENTS.md` | Instructions Pi reads in this repo: code rules, when the workflow applies, which tool to reach for |
| `docs/*_TEMPLATE.md` | Blank state files, copied to start each working file the workflow needs |
| `scripts/sync.sh` | `pull` / `push` between `agent/` and the live agent directory |
| `scripts/verify-plan-mode.mts` | Model-free checks for the plan-mode gates |

## `agent/` mirror

| Path | Pi's role | In this repo |
|---|---|---|
| `agent/settings.json` | Preferences, defaults, Pi package declarations | yes |
| `agent/mcp.json` | MCP servers available in every project | yes |
| `agent/models-store.json` | Custom/compatible model endpoints | yes |
| `agent/models.json`, `agent/keybindings.json`, `agent/SYSTEM.md`, `agent/APPEND_SYSTEM.md` | Optional overrides, not present yet | picked up by `sync.sh pull` once created |
| `agent/extensions/` | User extensions | yes — `plan-mode.ts` |
| `agent/agents/` | Custom subagent definitions | yes — `explorer.md` |
| `agent/prompts/` | Prompt templates, each one a `/command` | yes — `explore.md` |
| `agent/skills/` | Skills, each a directory with a `SKILL.md` | yes — `slice-workflow/` |
| `agent/themes/` | Optional user resource | copied recursively once created |
| `agent/auth.json`, `agent/mcp-auth.json` | Saved API keys / OAuth tokens | **never** (gitignored) |
| `agent/sessions/` | Conversation history | **never** (private, gitignored) |
| `agent/install/`, `agent/npm/`, `agent/bin/` | Pi release, npm packages, bundled binaries (~265 MB) | **never** (reproducible, gitignored) |
| `agent/pi-subagents/`, `agent/pi-web-access/` | Per-package runtime caches | **never** (gitignored) |

## Syncing

```sh
scripts/sync.sh pull    # live agent directory -> ./agent   (run before committing changes)
scripts/sync.sh push    # ./agent -> live agent directory   (run after cloning elsewhere)
```

Both directions copy an explicit whitelist of files and directories, so nothing outside the table
above moves in either direction. `push` copies any file it overwrites into a temporary directory and
prints the path, and `PI_CODING_AGENT_DIR` overrides the source/target location. Run `/reload` in Pi
(or restart it) after `push`.

## Setting up a new machine

1. Install Pi, then `git clone` this repo and run `scripts/sync.sh push`.
2. Add credentials separately — `pi login`, or edit `~/.pi/agent/auth.json` by hand. This repo
   intentionally stores no keys; locally `auth.json` only pins `LLAMA_BASE_URL`.
3. Provide the environment the config expects:
   - `CONTEXT7_API_KEY` — referenced by `agent/mcp.json` as `${CONTEXT7_API_KEY}`.
   - A llama.cpp server on `127.0.0.1:8089` — `agent/models-store.json` registers a local Qwen3.8
     GGUF there and it is the model this config runs on, so adjust or re-add models if that host
     differs.
   - `uvx` (serena) and `npx` (playwright) on `PATH` for those MCP servers.

## What the config adds

### MCP servers (`agent/mcp.json`)

| Server | How it starts | Used for |
|---|---|---|
| `serena` | `uvx` from `github.com/oraios/serena`, `--project .` | symbol navigation in the open project |
| `context7` | `https://mcp.context7.com/mcp` + `CONTEXT7_API_KEY` | library docs |
| `deepwiki` | `https://mcp.deepwiki.com/mcp` | docs for a GitHub repo |
| `playwright` | `npx @playwright/mcp@latest --headless` | verifying web behavior |

`AGENTS.md` routes symbol, docs and web questions to these instead of raw grepping.

### Pi packages (`agent/settings.json`)

`npm:pi-subagents`, which provides the `subagent` tool that the `explorer` subagent and plan mode
drive, and `npm:pi-web-access`, which provides `web_search`, `fetch_content`, `source_check` and
`get_search_content`. They install into `agent/npm/`, which is why that directory is never mirrored.

## Workflow

The loop — big picture, smallest next slice, plan it, implement, run and observe, record findings —
is the `slice-workflow` skill, and `AGENTS.md` is the ruleset that applies while doing it. State
lives in files, each started from the matching template in `docs/`:

| Working file | Template | Holds |
|---|---|---|
| `docs/BIG_PICTURE.md` | `docs/BIG_PICTURE_TEMPLATE.md` | idea, expected behavior, ordered slice list |
| `docs/FINDINGS.md` | `docs/FINDINGS_TEMPLATE.md` | standing facts, plus an append-only per-slice log |
| `docs/slices/NN-name/PLAN.md` | `docs/PLAN_TEMPLATE.md` | one slice: expected behavior, steps, verification, result |

Only the templates are tracked today; the first slice's filled-in files were removed once it shipped.
The pieces below are what make steps 2 and 3 work: `/explore` scans the codebase in a read-only child
so the parent context stays clean, and plan mode keeps the session read-only except for `docs/**.md`,
so a plan can be saved while code cannot be touched.

### `slice-workflow` — the loop on demand

Most tasks are smaller than the loop, so it no longer runs by default. `agent/skills/slice-workflow/SKILL.md`
holds the same seven steps and carries `disable-model-invocation: true`, which excludes it from the
system prompt entirely: Pi cannot reach it on its own, and it costs no tokens until asked for. Invoke
it as a command, with the idea as the argument:

```text
/skill:slice-workflow add a fast mode to plan mode
```

Arguments are appended to the loaded instructions as a user request. Drop the
`disable-model-invocation` line to let the model route to the skill itself when a task matches its
`description` — nothing else about the skill has to change.

## Extensions

### `plan-mode.ts` — read-only plan mode

`/plan`, `ctrl+shift+p`, or `pi --plan` turn it on; the same toggle turns it off. While on, the tool
set shrinks to read-only and support tools, `edit`/`write` only accept `docs/**/*.md`, `bash` only
accepts read-only commands with no shell metacharacters or output flags, `subagent` only accepts the
read-only agents (`explorer`, `scout`, `planner`, `reviewer`, `oracle`), read-only MCP tools such as
`mcp__context7__*`, `mcp__deepwiki__*` and the serena readers stay available, and every other tool is
dropped. The model is told the same through a `<plan_mode>` block in its system prompt, which also
tells it to save the plan to `docs/slices/<nn-slice-name>/PLAN.md`, and the mode survives a session
resume. Put the prompt before the flag or after `--` (`pi --plan -- "…"`), otherwise the flag eats it.

Verify the gating logic without a model: `node scripts/verify-plan-mode.mts` drives the real extension
against a fake `ExtensionAPI`; no network, no LLM.

## Subagents and prompt templates

### `explorer` — read-only codebase scanner

`agent/agents/explorer.md` defines the `explorer` subagent: a strict tool allowlist of `read, grep, find, ls`
(Pi's exact read-only tool set), `acceptanceRole: read-only`, and `async: false` so a scan returns its report
in the caller's turn instead of a background run id. It reports structure, entry points and data flow,
`path:line` references, conventions, and unknowns, and it cannot edit files or run commands. `plan-mode.ts`
lists it as read-only, so `/explore` keeps working inside plan mode. `extensions` is deliberately left unset:
an empty value would deny a background launch the ambient extensions, and the local `llama.cpp` model in
`models-store.json` then fails to resolve before the child starts — the `tools` allowlist, not the extension
list, is what keeps the child read-only.

### `explore.md` — `/explore [what to find out]`

`agent/prompts/explore.md` hands the scan to `explorer` instead of searching in the parent session, then
summarizes the report in under 15 lines with the paths worth reading next. With no arguments it asks for a
full map of the project.

## License

- Licensed under Apache-2.0 (see `LICENSE`); the config files are yours to reuse.
