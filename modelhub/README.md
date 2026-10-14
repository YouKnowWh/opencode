# OpenCode Model Hub fork

This opt-in desktop fork is based on upstream OpenCode **v1.19.0**
(`733b2c627e5aec39cb33cc22373bdce33053ef2c`). The upstream MIT license remains
unchanged. `origin` is the personal fork; `upstream` is `anomalyco/opencode`.
This fork is independently maintained and is not produced by or affiliated with
the OpenCode team. Compare `modelhub-desktop` against the pinned `modelhub-base`
branch; use that same base for a future PR, not the moving upstream `dev`.

## Behavior

- Settings → Model Hub opens the existing server console; model routing remains
  managed there. A role's real-model change applies to subsequent requests from
  **all clients of that role**, not just this desktop window.
- ARONA uses Chat Completions; PRANA uses native Responses. Each has its own key.
- Changing roles keeps the same project and conversation. The user explicitly
  authorized sharing its complete history for role handoff. Each new request uses
  the selected role; long-term memory retrieval and proposals remain role-local.
  A persisted selection is a convenience, not a lifetime authorization boundary.
- Read/search memory tools use the executing role's key; memory proposals need
  permission and remain subject to server review. Each memory call requires its
  host-provided `ctx.extra.model` to match `ctx.agent`; missing or mismatched
  execution identities are rejected before a memory request is sent. An in-flight
  tool keeps the role of the request that started it even after a role switch.
  Auxiliary title/summary calls follow their own request's provider and do not
  change the persisted role selection.
- The management login is separate from chat credentials. Credentials entered
  into the login form are held only in main-process memory and used for the
  window's HTTPS console Basic-auth challenge. They are not persisted by this
  addon or passed to model requests. Electron may cache authenticated connections;
  signing in again clears its HTTP authentication cache before registering the
  replacement credentials.
- The fork has a separate app ID and data directories. It does not migrate the
  official client's data automatically or install official updates over itself.
  The Model Hub pane can check upstream releases; adopting an update requires a
  reviewed rebase and rebuild.

## Local prerequisite

Existing, separately provisioned keys are read from:

```text
~/.local/share/modelhub-opencode/profiles/arona/key.json
~/.local/share/modelhub-opencode/profiles/prana/key.json
```

Each contains `role` and `key`. Files must belong to the current user and have
mode `0600`; directories must have mode `0700`. Never commit these files or paste
them in an issue. The combined desktop profile is created under `profiles/desktop`
with isolated config, data, cache, state and persisted current-role selection.
Project configuration is disabled. Bootstrap regenerates its managed configuration;
manual edits to that configuration are not an extension-management interface.
`32768`/`4096` limits are conservative client defaults, not measured capabilities.

The role key environment variables are removed from tool-shell environments.
This is **not an operating-system sandbox**: allowed file/shell tools can still
access user-owned files. Review tool permissions accordingly.

Bootstrap copies the locked plugin manifest and lockfile into the managed
configuration directory. Fork startup clears inherited OpenCode overrides and
uses the v1 sidecar; inherited v2-service and test-onboarding flags cannot select
the official client's background service or substitute temporary test storage.

## One-shot checks and macOS build

Use Bun 1.3.14 and the upstream workspace dependencies. Install the addon runtime
with `npm ci --ignore-scripts` inside `modelhub`. Electron's executable must be
installed separately if workspace dependency scripts were disabled.

```sh
cd packages/app
bun typecheck
bun test --conditions=solid --preload ./happydom.ts ./src/modelhub ./src/context/local-agent.test.ts ./src/context/model-variant.test.ts ./src/context/tabs.test.ts ./src/pages/layout/helpers.test.ts
cd ../desktop
bun typecheck
bun test ./src/main/modelhub-login.test.ts ./electron-builder.config.test.ts
cd ../../modelhub
node --test bindings.test.mjs plugin.test.mjs
node launch.mjs --config-check
cd ../packages/opencode
OPENCODE_VERSION=1.19.0-modelhub.1 OPENCODE_CHANNEL=dev bun script/build-node.ts
cd ../desktop
bun ./scripts/copy-icons.ts dev
bun ./scripts/copy-metainfo.ts dev
MODELHUB_BUILD=1 OPENCODE_CHANNEL=dev bun x --no-install electron-vite build
MODELHUB_BUILD=1 OPENCODE_CHANNEL=dev CSC_IDENTITY_AUTO_DISCOVERY=false bun x --no-install electron-builder --config electron-builder.config.ts --mac --dir --publish never
```

These commands do not start dev servers or watch tasks. Copy the resulting
`dist/mac-arm64/OpenCode Model Hub.app` only after the running fork has exited.
Do not replace or restart the official OpenCode app. Local builds are unsigned
and unnotarized; this is not an official signed release.

## Acceptance boundaries

On 2026-10-14, real CLI requests completed an ARONA → PRANA → ARONA handoff
within one session, with the complete prior conversation available on each
handoff. Separate PRANA and ARONA `memory_search`/`memory_read` runs completed
in 32.05 s and 6.677 s respectively. These are individual CLI-run durations,
not service latency benchmarks or GUI measurements.

The one-shot checks above passed 54 app tests, 10 desktop tests and 3 addon
Node tests: **67 tests in total**. App and desktop type checks also passed.
These checks cover role recognition and selection, request/tool identity guards,
per-execution memory credentials, scoped console login, the separate deep-link
protocol and packaging identity. The login checks use unit inputs rather than
a live console. Production builds were checked on macOS arm64 only.

The rebuilt bundle has **not been activated**. Desktop console authentication
and live role handoff/send in the GUI remain unverified; the current desktop
tool-permission prompt awaits the user's response. Passing CLI and unit checks
does not establish desktop acceptance.

Windows/Linux, history migration and a plugins/Skills configuration manager
remain unverified or unimplemented. No server code deployment or legacy
extraction-error repair is included in this fork.

## Rollback

Keep an existing fork bundle before replacement. Restore that bundle after the
fork exits, keeping `profiles/desktop` and both dedicated role keys unchanged.
The official app is independent. Keep role-specific request credentials and
memory-tool isolation. Never restore global-memory access as a rollback shortcut.
