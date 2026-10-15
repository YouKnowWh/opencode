# Model Hub fork changes

## 0.1.0 — 2026-10-14

- Open the unified server console from desktop settings in a light theme.
- Allow ARONA/PRANA handoff within the same project and conversation, sharing its
  history with explicit user authorization while keeping memory credentials local
  to the executing role.
- Validate the host-resolved agent/model pair and tool execution model; reject
  mismatched identities rather than silently selecting another role's memory.
- Isolate app identity, links, runtime configuration and update handling from the
  official desktop client; preload locked plugin dependencies.
- Check upstream releases through the desktop network bridge. Authentication and
  new-build GUI acceptance remain separate verification gates.

## Unreleased

- Share one Model Hub account across projects and windows, with optional encrypted
  login restoration after restart and global sign out.
- Use OpenCode's native settings controls for the account and authorized role LLMs;
  open the full server console only for advanced management.
- Preserve role budgets and auxiliary model settings when changing an LLM, and
  keep raw management response text out of native errors.
- Make the native app the everyday entry and retire Terminal-based `.command`
  launchers; optional CLI launch delegates to macOS Launch Services.
- Clarify the separate official/fork apps and the app-managed local backend.
- Verify console credentials before opening the embedded HUB; show specific
  authentication, connection, server and timeout errors with a retry form.
- Handle failed embedded-console navigation instead of leaving a blank panel.
