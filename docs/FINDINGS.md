# Findings

## Slice 01 — plan-mode extension

### API checks against the installed Pi 1.4.0 declarations

Everything the extension uses exists and behaves as written: `pi.on("tool_call")` accepts
`{ block, reason }` (`ToolCallEventResult`), `before_agent_start` accepts `{ systemPrompt }`
(`BeforeAgentStartEventResult`), `registerShortcut` takes a `KeyId` string so `"ctrl+shift+p"` type-checks,
`ctx.sessionManager.getEntries()` returns the entries used for resume, and `pi.getActiveTools()` /
`setActiveTools()` / `appendEntry()` are already bound when `session_start` fires — the resume path calls
all three from that handler in a real run without errors.

### Why gated tools stay declared

`canBeActiveWhilePlanning` keeps `bash`, `edit`, `write`, and `subagent` in the active set because they have
a rule; the rule is what denies the call. Observed in a real run, that means the model receives
`Plan mode: writes are limited to docs/**/*.md.` instead of a missing-tool error, which is what makes the
block self-explanatory. Everything without a rule and without a read-only listing (`codemode`,
`subagent_supervisor`, `contact_supervisor`, `list_mcp_resources`, `mcp__playwright__*`, and the
`subagents_enable` / `web_enable` activators) is dropped from the active set, so plan mode is default-deny.

### CLI gotcha

`pi --plan "some prompt"` swallows the prompt: the bare token after a boolean extension flag is parsed as
that flag's value, so Pi starts with no prompt and prints nothing (exit 0, no error). Put the prompt first
or separate it — `pi --plan -- "some prompt"` — which is also what `pi --help` hints at for prompts
beginning with `-`.

### Where verification code may not live

Pi loads every `*.ts` / `*.js` file directly inside an extensions directory as an extension, so the
fake-API harness lives in `scripts/verify-plan-mode.mts`, not next to the extension. (`.mts` happens to be
ignored by the loader, which is easy to misread as safety.)

### Model behaviour observed

With the local llama.cpp model in plan mode: `write notes.txt` blocked, `write docs/notes.md` allowed
(parent directory created automatically), `bash ls` allowed, `bash rm -f gone.txt` blocked with
`Plan mode: only read-only shell commands are allowed.` The same extension without `--plan` created
`notes.txt`, so the gate is attributable to plan mode and not to the extension load.

### Not exercised

No TTY was available, so `ctrl+shift+p` was only confirmed to register without a conflict (Pi prints
shortcut diagnostics on startup and printed none); the keystroke itself was not pressed.

### Follow-ups (not this slice)

- `isDocsMarkdown` trusts the resolved path; a symlink inside `docs/` pointing outside is not caught.
- No `/plan` status in print or JSON mode; `ctx.ui.setStatus` only reaches TUI and RPC clients.
- A raw `workflow` script passed to `subagent` is blocked because no `agent` key is present; fine today,
  but it will surprise someone eventually.
