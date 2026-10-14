# OpenCode Model Hub fork

This opt-in desktop fork is based on upstream OpenCode **v1.19.0**
(`733b2c627e5aec39cb33cc22373bdce33053ef2c`). The upstream MIT license remains
unchanged. `origin` is the personal fork; `upstream` is `anomalyco/opencode`.
The PR targets the pinned `modelhub-base` branch, not the moving upstream `dev`.

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
  permission and remain subject to server review. Auxiliary title/summary calls
  remain on that session's provider.
- The management login is separate from chat credentials. Credentials entered
  into the login form are held only in main-process memory and used for the
  window's HTTPS console Basic-auth challenge. They are not persisted by this
  addon or passed to model requests. Electron may cache authenticated connections.
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
with isolated config, data, cache, state and durable session bindings. Project
configuration is disabled. Bootstrap regenerates its managed configuration;
manual edits to that configuration are not an extension-management interface.
`32768`/`4096` limits are conservative client defaults, not measured capabilities.

The role key environment variables are removed from tool-shell environments.
This is **not an operating-system sandbox**: allowed file/shell tools can still
access user-owned files. Review tool permissions accordingly.

## One-shot checks and macOS build

Use Bun 1.3.14 and the upstream workspace dependencies. Install the addon runtime
with `npm ci --ignore-scripts` inside `modelhub`. Electron's executable must be
installed separately if workspace dependency scripts were disabled.

```sh
cd packages/app
bun typecheck
bun test --conditions=solid --preload ./happydom.ts ./src/modelhub ./src/context/local-agent.test.ts ./src/context/model-variant.test.ts ./src/context/tabs.test.ts
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

Real ARONA and PRANA CLI requests and same-session role handoff have
been observed. Unit checks cover role/draft isolation, durable selection,
same-session handoff, per-execution memory credentials, scoped console login
  and packaging identity.
Production builds were checked on macOS arm64 only.

Desktop console authentication, live role-handoff/send in the GUI, Windows/Linux,
history migration and a plugins/Skills configuration manager remain unverified
or unimplemented. CLI success does not establish GUI acceptance. No server code
deployment or legacy extraction-error repair is included in this fork.

## Rollback

Keep an existing fork bundle before replacement. Restore that bundle after the
fork exits, keeping `profiles/desktop` and both dedicated role keys unchanged.
The official app is independent. Keep role-specific request credentials and memory-tool isolation. Never restore
global-memory access as a rollback shortcut.
