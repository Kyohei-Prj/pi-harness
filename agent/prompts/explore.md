---
description: Scan the codebase with a read-only subagent
argument-hint: "[what to find out]"
---
Delegate this to the `explorer` subagent with the `subagent` tool. Do not scan the codebase yourself.

Task for the subagent: ${@:-Map the project: structure, entry points, data flow, conventions, and how tests run.}

The subagent is read-only and must not edit files or run commands. When it returns, summarize its findings in under 15 lines and list the file paths worth reading next.
