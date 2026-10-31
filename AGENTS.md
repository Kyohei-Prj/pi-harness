# Agent instructions

## Code rules
- **Minimalism.** Write the least code that produces the expected behavior. No speculative features, options, abstractions, or dependencies. Prefer deleting code to adding it.
- **Function length.** Every function has at most 5 lines of code, excluding comments and blank lines. When a function grows past that, extract a well-named function. This covers arrow functions, methods, callbacks, and test functions.
- **Self-documenting code.** Express intent through explicit, descriptive names for functions, variables, classes, and files. Rename instead of commenting. Comment only a non-obvious *why*, never a *what*.

## Tools
- You are authorized to delegate to the read-only `explorer` subagent for codebase scans.
- Use serena for symbol navigation, context7 for library docs, deepwiki for GitHub repo docs, playwright for verifying web behavior, and web_search/fetch_content for everything else on the web.
