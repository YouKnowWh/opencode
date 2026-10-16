# Shared projects and agent capability acceptance

This fork retains the upstream v1.19.0 execution engine. It is not a drop-in implementation of the Codex desktop product or its account-backed cloud services.

## Local work and handoff

Open the **same absolute project folder** in both clients using OpenCode's existing Open Project action. Do not copy the repository or import its credentials. Files, branches, uncommitted changes and project AGENTS.md are then shared immediately. Each application retains its own chat history, approvals and account storage. Role handoff inside OpenCode retains the current conversation; long-term memory remains role-isolated.

Model Hub's plugin appends absolute AGENTS.md paths from the worktree root to the opened directory. For a non-Git folder, the opened directory is the root. Symlinks resolving outside that boundary are skipped. Nested file-read instructions continue through the existing instruction machinery. This does not enable project opencode.json, provider credentials, or arbitrary project plugins.

Before changing a file after permission, edit/write/apply_patch compare the original bytes again. New files use exclusive creation. Patches preflight all approved targets before the first write and repeat the condition at each mutation. External changes during approval fail rather than being overwritten, including BOM-only changes, deletion and move targets. Existing deliberate whole-file replacements retain their old behavior if the original target remains unchanged.

These are optimistic checks, **not cross-process filesystem transactions**. An uncooperative external writer can still race between the last check and write. Multi-file patch failure after submission can leave partial changes. Coordinate edits to the same file; use separate Git worktrees for independent changes that overlap. Do not run Git checkout/reset/merge concurrently from both clients. Formatting is disabled in the managed profile.

## Capability coverage

| Capability | Implementation and evidence | Remaining boundary |
| --- | --- | --- |
| Existing local projects | Existing native folder picker; shared filesystem | Separate chat histories; no automatic Codex session import |
| Project instructions | ModelHub config hook supplies bounded absolute AGENTS paths | Project provider/plugin config deliberately disabled |
| Read, search, edit, patches | Existing tools plus stale-write guards; real temporary-file regressions | No distributed lock against another application |
| Shell, Git, one-shot tests/builds | Existing approved shell tool runs in project directory | Permission prompts are not an OS sandbox; no automatic dev/watch/background tasks |
| Questions and task tracking | Existing question and todo tools | Native app behavior follows upstream |
| Delegation | Role-specific `arona/prana-explore` and `-worker`; actual Agent.Service permissions checked | Foreground tasks only, depth one; requests tagged auxiliary to prevent automatic memory extraction |
| Read-only exploration | Explore denies edit, shell and memory proposals | Read/search and same-role memory access remain allowed |
| Implementation helpers | Same-role worker, approved writes/shell, no further delegation | Explicit user/project authorization still required to delegate |
| Review | `/review` prompt follows current role rather than disabled general agent | Review instructions do not create an OS-enforced read-only execution mode |
| Skills | Native settings add existing absolute skill folders; actual Skill.Service discovery checked | No automatic copy of all Codex plugins or private files |
| MCP | Native settings persist remote HTTPS endpoints; actual MCP.Service discovery checked | Connection and OAuth require per-server acceptance; no imported secret headers or local processes |
| Extensions across restarts | Private, bounded, atomically replaced extensions.json; revision rejects stale window saves | New settings take effect at the next client start; no interruption of running tasks |
| Role models and memory | Existing authenticated ModelHub integration | Server evaluator deployment accepted separately |
| Codex Apps, cloud work, reset cards, computer use, schedules | Not implemented by this change | Requires supported integration and separate consent/testing; not made available by copying Codex configuration |

The Codex comparison was checked against the official manual on 2026-10-16, including [subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents.md) and [Skills](https://learn.chatgpt.com/docs/build-skills.md). A common SKILL.md format permits reusing authored workflows; it does not transfer connector accounts, hosted computers, permissions or tool implementations.

## Reproducible acceptance

- `node --test modelhub/*.test.mjs`: private extension persistence, validation/size, stale revision rejection, bounded instructions, host-resolved role checks and config policy.
- From packages/opencode: `bun test --timeout 30000 test/tool/edit.test.ts test/tool/write.test.ts test/tool/apply_patch.test.ts test/session/instruction.test.ts test/skill/skill.test.ts`.
- From packages/core: `bun test --timeout 30000 test/file-mutation.test.ts`.
- Existing app ModelHub/context and desktop account/build tests; package typechecks and one-shot production build.
- Synthetic real-service checks use temporary projects, disabled MCP endpoints and no model API. Their evidence is separate from GUI/live acceptance.

No development server, watch task or standalone background process is required for these checks.
