import { relative, resolve, sep } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const READ_ONLY_BUILTIN_TOOLS = ["read", "grep", "find", "ls"];
const SUPPORT_TOOLS = ["tool_search", "subagents_enable", "bg_wait", "web_search", "fetch_content", "get_search_content", "source_check"];
const READ_ONLY_SUBAGENTS = ["explorer", "scout", "planner", "reviewer", "oracle"];
const SAFE_BASH_COMMAND = /^(git (status|diff|log|show)|ls|cat|head|tail|wc|rg|grep|tree|pwd)(\s|$)/;
const SHELL_METACHARACTERS = /[;&|<>`$()\n]/;
const DANGEROUS_FLAGS = /(--output|--pre|-exec|-delete)/;
const READ_ONLY_MCP_TOOLS = [
  /^mcp__context7__/,
  /^mcp__deepwiki__/,
  /^mcp__serena__(find_symbol|find_referencing_symbols|get_symbols_overview|search_for_pattern|list_dir|find_file|read_file|list_memories|read_memory)$/,
];
const PLAN_MODE_PROMPT = `

<plan_mode>
Plan mode is ON. You are read-only. Investigate, then plan exactly one slice.
- Do not change code. The only files you may write are markdown files under docs/.
- Use the explorer subagent for broad scans; use serena, context7 and deepwiki for symbols and docs.
- Save the plan to docs/slices/<nn-slice-name>/PLAN.md: expected behavior, steps, files touched, how to verify.
- Finish by asking the user to run /plan to leave plan mode before implementing.
</plan_mode>`;

type PlanState = { isPlanning: boolean; toolsBeforePlanning: string[] };
type Rule = { isAllowed: (input: any, cwd: string) => boolean; reason: string };

const isDocsMarkdown = (path: string, cwd: string) =>
  /^docs\/.+\.md$/.test(relative(cwd, resolve(cwd, path)).split(sep).join("/"));

const isSafeBash = (command: string) =>
  SAFE_BASH_COMMAND.test(command.trim()) && !SHELL_METACHARACTERS.test(command) && !DANGEROUS_FLAGS.test(command);

const isReadOnlyMcp = (toolName: string) => READ_ONLY_MCP_TOOLS.some((pattern) => pattern.test(toolName));

const referencedSubagents = (input: unknown) =>
  [...JSON.stringify(input).matchAll(/"agent"\s*:\s*"([^"]+)"/g)].map((match) => match[1]);

const onlyReadOnlySubagents = (input: unknown) => {
  const names = referencedSubagents(input);
  return names.length > 0 && names.every((name) => READ_ONLY_SUBAGENTS.includes(name));
};

const docsWriteRule: Rule = {
  isAllowed: (input, cwd) => isDocsMarkdown(input.path ?? "", cwd),
  reason: "writes are limited to docs/**/*.md",
};

const RULES_BY_TOOL: Record<string, Rule> = {
  bash: { isAllowed: (input) => isSafeBash(input.command ?? ""), reason: "only read-only shell commands are allowed" },
  write: docsWriteRule,
  edit: docsWriteRule,
  subagent: { isAllowed: onlyReadOnlySubagents, reason: "only read-only subagents may run" },
};

const isAlwaysAllowed = (toolName: string) =>
  [...READ_ONLY_BUILTIN_TOOLS, ...SUPPORT_TOOLS].includes(toolName) || isReadOnlyMcp(toolName);

const canBeActiveWhilePlanning = (toolName: string) => isAlwaysAllowed(toolName) || toolName in RULES_BY_TOOL;

function blockReason(toolName: string, input: unknown, cwd: string): string | undefined {
  const rule = RULES_BY_TOOL[toolName];
  if (rule) return rule.isAllowed(input, cwd) ? undefined : `Plan mode: ${rule.reason}.`;
  return isAlwaysAllowed(toolName) ? undefined : `Plan mode: ${toolName} is unavailable. Run /plan to leave.`;
}

function setPlanning(pi: ExtensionAPI, state: PlanState, ctx: ExtensionContext, enabled: boolean) {
  if (enabled && !state.isPlanning) state.toolsBeforePlanning = pi.getActiveTools();
  state.isPlanning = enabled;
  pi.setActiveTools(enabled ? state.toolsBeforePlanning.filter(canBeActiveWhilePlanning) : state.toolsBeforePlanning);
  ctx.ui.setStatus("plan-mode", enabled ? "PLAN (read-only)" : undefined);
  pi.appendEntry("plan-mode", { enabled });
}

const wasPlanningWhenSaved = (ctx: ExtensionContext) =>
  (ctx.sessionManager.getEntries() as any[])
    .filter((entry) => entry.type === "custom" && entry.customType === "plan-mode")
    .at(-1)?.data?.enabled === true;

const restoreOnStart = (pi: ExtensionAPI, state: PlanState) => async (_event: unknown, ctx: ExtensionContext) => {
  const shouldPlan = pi.getFlag("plan") === true || wasPlanningWhenSaved(ctx);
  if (shouldPlan) setPlanning(pi, state, ctx, true);
};

const blockMutatingTools = (state: PlanState) => async (event: any, ctx: ExtensionContext) => {
  if (!state.isPlanning) return;
  const reason = blockReason(event.toolName, event.input, ctx.cwd);
  if (reason) return { block: true, reason };
};

const appendPlanningPrompt = (state: PlanState) => async (event: any) =>
  state.isPlanning ? { systemPrompt: event.systemPrompt + PLAN_MODE_PROMPT } : undefined;

function registerControls(pi: ExtensionAPI, state: PlanState) {
  const toggle = (ctx: ExtensionContext) => setPlanning(pi, state, ctx, !state.isPlanning);
  pi.registerFlag("plan", { description: "Start in read-only plan mode", type: "boolean", default: false });
  pi.registerCommand("plan", { description: "Toggle read-only plan mode", handler: async (_args, ctx) => toggle(ctx) });
  pi.registerShortcut("ctrl+shift+p", { description: "Toggle plan mode", handler: async (ctx) => toggle(ctx) });
}

export default function planMode(pi: ExtensionAPI) {
  const state: PlanState = { isPlanning: false, toolsBeforePlanning: [] };
  registerControls(pi, state);
  pi.on("session_start", restoreOnStart(pi, state));
  pi.on("tool_call", blockMutatingTools(state));
  pi.on("before_agent_start", appendPlanningPrompt(state));
}
