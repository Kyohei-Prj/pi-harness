// Throwaway harness: drives the extension against a fake ExtensionAPI. Run: node <this file>
import assert from "node:assert/strict";
import planMode from "../agent/extensions/plan-mode.ts";

type Handler = (...args: any[]) => any;

const makePi = (flags: Record<string, unknown> = {}, active = ["read", "bash", "edit", "write", "subagent", "codemode", "web_search", "mcp__context7__query_docs", "mcp__serena__insert_symbol"]) => {
  const h = new Map<string, Handler[]>();
  const state = { active: [...active], entries: [] as any[], status: new Map<string, string | undefined>(), commands: new Map<string, any>(), shortcuts: new Map<string, any>(), flags: { plan: false, ...flags } as Record<string, unknown> };
  const pi: any = {
    handlers: h,
    state,
    on: (event: string, handler: Handler) => h.set(event, [...(h.get(event) ?? []), handler]),
    registerTool: () => {},
    registerCommand: (name: string, opts: any) => state.commands.set(name, opts),
    registerShortcut: (key: string, opts: any) => state.shortcuts.set(key, opts),
    registerFlag: (name: string, opts: any) => (state.flags[name] ??= opts.default),
    getFlag: (name: string) => state.flags[name],
    appendEntry: (type: string, data: unknown) => state.entries.push({ type: "custom", customType: type, data }),
    getActiveTools: () => [...state.active],
    setActiveTools: (names: string[]) => (state.active = [...names]),
  };
  return pi;
};

const makeCtx = (pi: any, cwd = "/repo", entries: any[] = []) => ({
  cwd,
  ui: { setStatus: (key: string, text: string | undefined) => pi.state.status.set(key, text), notify: () => {} },
  sessionManager: { getEntries: () => entries },
});

const emit = async (pi: any, event: string, payload: any, ctx?: any) => {
  let result: any;
  for (const handler of pi.handlers.get(event) ?? []) result = (await handler(payload, ctx)) ?? result;
  return result;
};

const start = async (pi: any, ctx: any) => emit(pi, "session_start", { reason: "startup" }, ctx);
const toggle = async (pi: any, ctx: any) => pi.state.commands.get("plan").handler("", ctx);
const blocked = async (pi: any, ctx: any, toolName: string, input: any) => (await emit(pi, "tool_call", { toolName, input }, ctx))?.block === true;
const prompt = async (pi: any, text = "BASE") => (await emit(pi, "before_agent_start", { systemPrompt: text, messageType: "user" }))?.systemPrompt;

const registrations = () => {
  const pi = makePi();
  planMode(pi);
  assert.ok(pi.state.flags.plan === false && pi.state.commands.has("plan") && pi.state.shortcuts.has("ctrl+shift+p"));
  assert.equal(pi.handlers.get("tool_call").length, 1);
  console.log("pass  registers /plan, ctrl+shift+p, --plan, and three handlers");
};

const idleAllowsEverything = async () => {
  const pi = makePi();
  const ctx = makeCtx(pi);
  planMode(pi);
  await start(pi, ctx);
  assert.equal(await blocked(pi, ctx, "write", { path: "src/app.ts" }), false);
  assert.equal(await blocked(pi, ctx, "bash", { command: "rm -rf /tmp/x" }), false);
  assert.equal(await prompt(pi), undefined);
  assert.equal(pi.state.status.get("plan-mode"), undefined);
  console.log("pass  outside plan mode nothing is blocked and no prompt is injected");
};

const onShrinksToolsAndInjects = async () => {
  const pi = makePi();
  const ctx = makeCtx(pi);
  planMode(pi);
  await start(pi, ctx);
  await toggle(pi, ctx);
  assert.deepEqual(pi.state.active, ["read", "bash", "edit", "write", "subagent", "web_search", "mcp__context7__query_docs"]);
  assert.equal(pi.state.status.get("plan-mode"), "PLAN (read-only)");
  assert.match(await prompt(pi), /<plan_mode>[\s\S]*Plan mode is ON/);
  assert.deepEqual(pi.state.entries.at(-1), { type: "custom", customType: "plan-mode", data: { enabled: true } });
  console.log("pass  enabling drops codemode/mcp-writers, keeps gated tools declared, sets status, injects prompt, persists");
};

const gates = async () => {
  const pi = makePi();
  const ctx = makeCtx(pi);
  planMode(pi);
  await start(pi, ctx);
  await toggle(pi, ctx);
  for (const [tool, input, allowed] of READ_ONLY_CASES) assert.equal(await blocked(pi, ctx, tool, input), !allowed, `${tool} ${JSON.stringify(input)} expected allowed=${allowed}`);
  console.log("pass  bash/write/edit/subagent/mcp gates match the read-only rules");
};

const READ_ONLY_CASES: [string, any, boolean][] = [
  ["read", { path: "src/app.ts" }, true],
  ["grep", { pattern: "x" }, true],
  ["bash", { command: "git status" }, true],
  ["bash", { command: "rg plan agent" }, true],
  ["bash", { command: "ls -la" }, true],
  ["bash", { command: "rm -rf /tmp/x" }, false],
  ["bash", { command: "ls | wc -l" }, false],
  ["bash", { command: "echo hi > docs/a.md" }, false],
  ["bash", { command: "git log --output=/tmp/x" }, false],
  ["bash", { command: "find . -name x -delete" }, false],
  ["bash", { command: "git statusX" }, false],
  ["write", { path: "docs/slices/01/PLAN.md" }, true],
  ["write", { path: "docs/a.md" }, true],
  ["write", { path: "/repo/docs/deep/nested/a.md" }, true],
  ["write", { path: "src/app.ts" }, false],
  ["write", { path: "docs/a.ts" }, false],
  ["write", { path: "../docs/a.md" }, false],
  ["write", { path: "/etc/passwd" }, false],
  ["edit", { path: "docs/BIG_PICTURE.md" }, true],
  ["edit", { path: "agent/settings.json" }, false],
  ["subagent", { agent: "explorer", task: "scan" }, true],
  ["subagent", { agent: "explorer", workflow: "x", tasks: [{ agent: "reviewer" }] }, true],
  ["subagent", { agent: "general-purpose", task: "write it" }, false],
  ["subagent", { workflow: "raw.ts" }, false],
  ["subagent", { agent: "explorer", tasks: [{ agent: "general-purpose" }] }, false],
  ["mcp__context7__query_docs", {}, true],
  ["mcp__deepwiki__read", {}, true],
  ["mcp__serena__find_symbol", {}, true],
  ["mcp__serena__write_memory", {}, false],
  ["mcp__playwright__browser_navigate", {}, false],
  ["codemode", { code: "tools.bash({command:'rm -rf /'})" }, false],
  ["tool_search", {}, true],
  ["bg_wait", {}, true],
  ["list_mcp_resources", {}, false],
];

const offRestores = async () => {
  const pi = makePi();
  const ctx = makeCtx(pi);
  const before = pi.state.active.join(",");
  planMode(pi);
  await start(pi, ctx);
  await toggle(pi, ctx);
  await toggle(pi, ctx);
  assert.equal(pi.state.active.join(","), before);
  assert.equal(pi.state.status.get("plan-mode"), undefined);
  assert.equal(await prompt(pi), undefined);
  assert.equal(await blocked(pi, ctx, "bash", { command: "rm -rf /tmp/x" }), false);
  assert.deepEqual(pi.state.entries.map((e: any) => e.data.enabled), [true, false]);
  console.log("pass  disabling restores the exact prior tool set and stops blocking");
};

const resumedPlanning = async () => {
  const entries = [{ type: "custom", customType: "plan-mode", data: { enabled: true } }];
  const pi = makePi();
  const ctx = makeCtx(pi, "/repo", entries);
  planMode(pi);
  await start(pi, ctx);
  assert.equal(pi.state.status.get("plan-mode"), "PLAN (read-only)");
  assert.equal(await blocked(pi, ctx, "write", { path: "src/app.ts" }), true);
  assert.equal(await blocked(pi, ctx, "write", { path: "docs/a.md" }), false);
  console.log("pass  a session saved in plan mode resumes in plan mode");
};

const flagStart = async () => {
  const pi = makePi({ plan: true });
  const ctx = makeCtx(pi);
  planMode(pi);
  await start(pi, ctx);
  assert.equal(pi.state.status.get("plan-mode"), "PLAN (read-only)");
  console.log("pass  --plan starts the session in plan mode");
};

const offEntryStaysOff = async () => {
  const entries = [{ type: "custom", customType: "plan-mode", data: { enabled: false } }];
  const pi = makePi();
  const ctx = makeCtx(pi, "/repo", entries);
  planMode(pi);
  await start(pi, ctx);
  assert.equal(pi.state.status.get("plan-mode"), undefined);
  console.log("pass  a session saved outside plan mode resumes normally");
};

const run = async () => {
  registrations();
  await idleAllowsEverything();
  await onShrinksToolsAndInjects();
  await gates();
  await offRestores();
  await resumedPlanning();
  await flagStart();
  await offEntryStaysOff();
  console.log("\nall plan-mode checks passed");
};

await run();
