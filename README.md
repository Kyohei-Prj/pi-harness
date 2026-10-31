# pi-harness

Version-controlled configuration for the [Pi coding agent](https://github.com/badlogic/pi-mono).
`agent/` mirrors the user-level agent directory (by default `~/.pi/agent`) and holds only the
files that describe *how Pi should behave* — no credentials, no installs, no chat history.

## Layout

| Path | Pi's role | In this repo |
|---|---|---|
| `agent/settings.json` | Preferences, defaults, Pi package declarations | yes |
| `agent/mcp.json` | MCP servers available in every project | yes |
| `agent/models-store.json` | Custom/compatible model endpoints | yes |
| `agent/models.json`, `agent/keybindings.json`, `agent/SYSTEM.md`, `agent/APPEND_SYSTEM.md` | Optional overrides, not present yet | picked up by `sync.sh pull` once created |
| `agent/extensions/` | User extensions | yes — `plan-mode.ts` |
| `agent/agents/` | Custom subagent definitions | yes — `explorer.md` |
| `agent/prompts/` | Prompt templates, each one a `/command` | yes — `explore.md` |
| `agent/skills/`, `agent/themes/` | Optional user resources | copied recursively once created |
| `agent/auth.json`, `agent/mcp-auth.json` | Saved API keys / OAuth tokens | **never** (gitignored) |
| `agent/sessions/` | Conversation history | **never** (private, gitignored) |
| `agent/install/`, `agent/npm/`, `agent/bin/` | Pi release, npm packages, bundled binaries (~265 MB) | **never** (reproducible, gitignored) |
| `agent/pi-subagents/`, `agent/pi-web-access/` | Per-package runtime caches | **never** (gitignored) |

## Syncing

```sh
scripts/sync.sh pull    # live agent directory -> ./agent   (run before committing changes)
scripts/sync.sh push    # ./agent -> live agent directory   (run after cloning elsewhere)
```

Both directions skip secrets and runtime state. `push` copies any file it overwrites into a
temporary directory and prints the path, and `PI_CODING_AGENT_DIR` overrides the source/target
location. Run `/reload` in Pi (or restart it) after `push`.

## Setting up a new machine

1. Install Pi, then `git clone` this repo and run `scripts/sync.sh push`.
2. Add credentials separately — `pi login`, or edit `~/.pi/agent/auth.json` by hand. This repo
   intentionally stores no keys; `auth.json` currently only pins `LLAMA_BASE_URL`.
3. Provide the environment variables the config expects:
   - `CONTEXT7_API_KEY` — referenced by `agent/mcp.json` as `${CONTEXT7_API_KEY}`.
   - A llama.cpp server on `127.0.0.1:8089` — `agent/models-store.json` points the default
     model at it, so adjust or re-add models if that host differs.
   - `uvx` (serena), `npx` (playwright) on `PATH` for those MCP servers.

## Extensions

### `plan-mode.ts` — read-only plan mode

`/plan`, `ctrl+shift+p`, or `pi --plan` turn it on; the same toggle turns it off. While on, the tool set
shrinks to read-only and support tools, `edit`/`write` only accept `docs/**/*.md`, `bash` only accepts
read-only commands, `subagent` only accepts read-only subagents, and every other unlisted tool is dropped.
The model is told the same through a `<plan_mode>` block in its system prompt, and the mode survives a
session resume. Put the prompt before the flag or after `--` (`pi --plan -- "…"`), otherwise the flag eats it.

Verify the gating logic without a model: `node scripts/verify-plan-mode.mts`.

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

## Notes

- `.serena/` is Serena's own project config, unrelated to Pi; it is left untracked here.
- Licensed under Apache-2.0 (see `LICENSE`); the config files are yours to reuse.
