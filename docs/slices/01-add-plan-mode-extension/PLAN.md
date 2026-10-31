# Slice 01 — Add the plan-mode extension

## Expected behavior

`~/.pi/agent/extensions/plan-mode.ts` loads in every Pi session and provides `/plan`,
`ctrl+shift+p`, `--plan`, tool gating, system-prompt injection, and resume-safe state, exactly as
spelled out in `docs/BIG_PICTURE.md`.

## Steps

1. Mirror the extension at `agent/extensions/plan-mode.ts` (this repo is the source of truth).
2. Check the API surface against the installed Pi 1.4.0 type declarations before trusting the code.
3. Verify the gating logic with a fake `ExtensionAPI`/`ExtensionContext` harness — no model calls,
   so every rule is observable deterministically.
4. Verify a real load: `scripts/sync.sh push`, then drive `pi --mode rpc --no-session` and compare
   active tools with and without `--plan`.
5. Record findings in `docs/FINDINGS.md`.

## Files touched

- `agent/extensions/plan-mode.ts` (new)
- `scripts/verify-plan-mode.mts` (fake-`ExtensionAPI` harness; kept as the regression check)
- `docs/BIG_PICTURE.md`, `docs/FINDINGS.md`, this plan, `README.md`

## How to verify

- `node scripts/verify-plan-mode.mts` → prints pass/fail per rule, no model calls.
- Real runtime: `pi --mode rpc --no-session` plus a `/probe` command that reports `pi.getActiveTools()`,
  before and after sending `/plan`. RPC has no command that reports tools, so the probe supplies them and
  `setStatus` records confirm the mode (`docs/FINDINGS.md`).
- Real model, in a scratch directory: `pi --print --no-session --extension … --plan -- "create notes.txt
  with the write tool"` must leave no file and quote the block reason; dropping `--plan` must create it.
