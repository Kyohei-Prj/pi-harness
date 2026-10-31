# Agent instructions

## Code rules
- **Minimalism.** Write the least code that produces the expected behavior. No speculative features, options, abstractions, or dependencies. Prefer deleting code to adding it.
- **Function length.** Every function has at most 5 lines of code, excluding comments and blank lines. When a function grows past that, extract a well-named function. This covers arrow functions, methods, callbacks, and test functions.
- **Self-documenting code.** Express intent through explicit, descriptive names for functions, variables, classes, and files. Rename instead of commenting. Comment only a non-obvious *why*, never a *what*.

## Workflow
Deliver in slices. Keep state in files, not in conversation memory.

1. **Big picture.** Take the idea and write `docs/BIG_PICTURE.md`: goal, expected behavior, and an ordered list of slices. Ask the user only if an ambiguity would change the slice list.
2. **Pick a slice.** Read `docs/BIG_PICTURE.md` and `docs/FINDINGS.md`. Take the smallest next slice that yields observable behavior and think through how to implement it. If the code is unfamiliar, run `/explore` first.
3. **Plan the slice.** In plan mode (`/plan`), write `docs/slices/NN-name/PLAN.md`: expected behavior, steps, files touched, and how it will be run and verified.
4. **Implement** exactly the plan. Leave plan mode first. If the plan is wrong, fix the plan before the code.
5. **Run and verify.** Run what you built and observe the real behavior against the expected behavior. Use Playwright for web UI; run CLIs, servers, and tests directly. Report what you observed, not what you expect.
6. **Note findings.** Append to `docs/FINDINGS.md`: surprises, decisions and why, constraints, follow-ups for later slices. Update `docs/BIG_PICTURE.md` if the picture changed.
7. **Repeat** from step 2 until every slice is done.

## Definition of done
A slice is done when its expected behavior is met, as observed in step 5.

## Tools
- You are authorized to delegate to the read-only `explorer` subagent for codebase scans.
- Use serena for symbol navigation, context7 for library docs, deepwiki for GitHub repo docs, playwright for verifying web behavior, and web_search/fetch_content for everything else on the web.
