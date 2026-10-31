# Big picture

## Goal

Ship a user-level `plan mode` extension for Pi in this repo so that any Pi session can switch to a
read-only investigation mode: the agent may search, read, and write markdown plans under `docs/`,
but cannot mutate code, run mutating shell commands, or launch writer subagents.

## Expected behavior

1. `/plan` (or `ctrl+shift+p`, or `pi --plan`) turns plan mode on; the same toggle turns it off.
2. While on, Pi's status area shows `PLAN (read-only)` and the active tool set shrinks to read-only
   and support tools.
3. While on, every mutating tool call is blocked with a reason: `edit`/`write` outside `docs/**/*.md`,
   `bash` outside a read-only allowlist, `subagent` unless every referenced subagent is read-only,
   and any other tool that is not explicitly read-only (default deny).
4. The model's system prompt gains a `<plan_mode>` block that states the restrictions and where to
   save the plan.
5. State survives a session resume: a session saved with plan mode on starts with plan mode on.
6. Turning plan mode off restores the exact tool set that was active before it was enabled.

## Status

Slice 1 is done and installed: `node scripts/verify-plan-mode.mts` passes 8 checks against a fake API, and a
real Pi run blocks `write notes.txt`, allows `write docs/notes.md`, and drops `codemode` from the active set
while plan mode is on (see `docs/FINDINGS.md`).

## Slices

1. **Add the extension** — `agent/extensions/plan-mode.ts` plus the repo docs describing it.
   Verified with a fake-`ExtensionAPI` harness (no model calls) and a real Pi load through RPC mode.

## Out of scope

- Plan/todo extraction and progress widgets (the built-in `plan-mode` example already covers that).
- Per-project opt-out, and sandboxing beyond tool gating.
