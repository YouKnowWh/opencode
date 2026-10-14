# Model Hub fork changes

## 0.1.0 — 2026-10-14

- Integrate the unified server console in desktop settings with a light theme.
- Allow ARONA/PRANA handoff within the same project and conversation, sharing its
  history with explicit user authorization while keeping memory credentials local
  to the executing role.
- Validate the host-resolved agent/model pair and tool execution model; reject
  mismatched identities rather than silently selecting another role's memory.
- Isolate app identity, links, runtime configuration and update handling from the
  official desktop client; preload locked plugin dependencies.
- Check upstream releases through the desktop network bridge. Authentication and
  new-build GUI acceptance remain separate verification gates.
