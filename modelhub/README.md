# OpenCode Model Hub fork

This opt-in desktop fork is based on upstream OpenCode **v1.19.0**
(`733b2c627e5aec39cb33cc22373bdce33053ef2c`). The upstream MIT license remains
unchanged. `origin` is the personal fork; `upstream` is `anomalyco/opencode`.
This fork is independently maintained and is not produced by or affiliated with
the OpenCode team. Compare `modelhub-desktop` against the pinned `modelhub-base`
branch; use that same base for a future PR, not the moving upstream `dev`.

## Behavior

- Settings → Model Hub uses OpenCode's native v2 settings rows and model selectors.
  The server console opens only on demand for advanced management. A role's real-model change applies to subsequent requests from
  **all clients of that role**, not just this desktop window.
- Settings → Providers groups the provisioned role connections into one
  **ModelHub** entry. Manage opens the native Model Hub settings. While these
  managed connections are present, the popular/custom-provider connection section
  is hidden. Role keys, protocol identities and existing other connections are
  preserved; grouping is only a presentation change.
- ARONA uses Chat Completions; PRANA uses native Responses. Each has its own key.
- Changing roles keeps the same project and conversation. The user explicitly
  authorized sharing its complete history for role handoff. Each new request uses
  the selected role; long-term memory retrieval and proposals remain role-local.
  A persisted selection is a convenience, not a lifetime authorization boundary.
- Read/search memory tools use the executing role's key; memory proposals need
  permission and remain subject to server review. Each memory call requires its
  host-provided `ctx.extra.model` to resolve to the role of `ctx.agent`, including
  same-role explore/worker helpers; missing or mismatched execution identities
  are rejected before a memory request is sent. An in-flight
  tool keeps the role of the request that started it even after a role switch.
  Auxiliary title/summary calls follow their own request's provider and do not
  change the persisted role selection.
- The management account is global across projects, settings mounts and windows,
  separate from role chat keys. The titlebar account entry and Settings → Account
  share the same state. Remembering login restores it after application restart;
  only Electron safeStorage ciphertext is saved, with private file permissions and
  atomic replacement. There is no plaintext or Linux `basic_text` fallback. A
  storage failure is visible rather than reported as a remembered login.
- Native HTTPS verifies the fixed `/hub/` document with a 15-second timeout,
  no redirects and no cookies. Typed errors preserve the username and clear the
  form password. Restored credentials are verified again; offline/403 failures
  retain the encrypted record, while rejected authentication removes it. Sign out
  clears shared memory, the encrypted file and Electron's Hub auth cache/storage.
  A late startup/login result cannot undo sign out. An offline saved account can
  also be explicitly cleared. Main-process credentials never enter model requests
  or renderer account state; form input is sent only through the trusted bridge.
- Native role-model controls expose only the safe role/model projection and allow
  authorized LLM selection. The fixed role settings API preserves embedding,
  ranker, timeout, concurrency, budget and remaining fallback targets. It does not
  grant new models. Management response size is bounded and raw response errors
  are discarded. Advanced console frames receive one scoped Basic challenge;
  closing settings or a window does not sign out the global account. A 20-second
  loading deadline still prevents an indefinitely blank embedded panel.
- The fork has a separate app ID and data directories. It does not migrate the
  official client's data automatically or install official updates over itself.
  The Model Hub pane can check upstream releases; adopting an update requires a
  reviewed rebase and rebuild.

## Everyday desktop entry

Open **OpenCode Model Hub.app** from the Desktop shortcut or `~/Applications`.
Its settings include **Model Hub**. The separate **OpenCode.app** is the official
client and does not contain this fork's settings pane.

The app owns its local backend as an Electron utility child, with piped output;
it needs no Terminal window or separately launched service. The server continues
to provide model routing and role memory, while tasks execute locally. The retired
`.command` launchers are no longer distributed. The optional `node launch.mjs`
entry delegates to macOS Launch Services, without holding a console attached to
the app. No-argument launch does not read or prepare credentials itself.

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
Project provider/plugin configuration is disabled. The managed plugin separately loads
bounded project AGENTS.md instructions. Bootstrap regenerates the managed routing
configuration; use Settings → Model Hub → Project and extensions for persistent
Skills folders and remote HTTPS MCP endpoints. Extensions apply at the next client
start and cannot override role providers, keys or permissions. Stale saves from a
second window are rejected rather than overwriting newer settings.
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
bun test ./src/main/modelhub-login.test.ts ./src/main/modelhub-account.test.ts ./src/main/modelhub-vault.test.ts ./src/main/modelhub-management.test.ts ./electron-builder.config.test.ts
cd ../../modelhub
node --test *.test.mjs
node launch.mjs --config-check
cd ../packages/opencode
OPENCODE_VERSION=1.19.0-modelhub.2 OPENCODE_CHANNEL=dev bun script/build-node.ts
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

Before the login-recovery change, the one-shot checks passed 54 app tests,
10 desktop tests and 3 addon Node tests: **67 tests in total**. App and desktop
type checks also passed.
These checks cover role recognition and selection, request/tool identity guards,
per-execution memory credentials, scoped console login, the separate deep-link
protocol and packaging identity. The login checks use unit inputs rather than
a live console. Production builds were checked on macOS arm64 only.

For the login-recovery fix (`f82f8ba`, 2026-10-15), 59 app tests and 15 desktop
tests passed: **74 related tests**, along with both package type checks.
The production build and macOS arm64 packaging succeeded. With explicit user
authorization, the previous fork was backed up and the repair bundle was installed
and reopened through the native app. The installed-app checks below distinguish the earlier role
handoff from the newer rejected-login check; each verifies only its tested flow.

Windows/Linux and history migration remain unverified or unimplemented.
Native Skills/MCP settings are implemented; their installed-app acceptance is
pending with the shared-project changes below. No server code deployment or legacy
extraction-error repair is included in this fork.

### Global account and native settings — 2026-10-16

Fresh checks pass **59 app + 35 desktop = 94 related tests**, plus both package
type checks. They cover shared account state, encrypted-file lifecycle, restart
simulation, same-tick startup/sign-out races, failed persistence, malformed IPC,
403 versus 401, bounded safe management responses, and role-model restrictions.
The independent review found and verified fixes for startup restoration racing
sign out, forbidden access deleting a saved account, and JSON errors leaking raw
response text. The latter also passed a Node 24 runtime check.

These are synthetic/offline checks, including injected encryption in vault tests.
The new build was backed up, installed and opened with explicit user approval.
The installed `app.asar` matches the packaged SHA256
`f8d9dd31b187dfc75ac09df84ba1f2d247432c421c688faf4479cc43b3103232`.
The titlebar account entry, native Account page with Remember login checked, and
native Model Hub page are visible; the official OpenCode process remains running.
Private screenshots and accessibility evidence are retained outside Git.
At this initial activation, the app awaited the user's own login; persistent-login
acceptance is recorded below. Multiple-window behavior, live sign-out cleanup and
authenticated native model mutations still require installed-app acceptance.
No server was accessed over SSH and no production memory was modified.

### Provider-entry acceptance — 2026-10-16

The provider settings now show one **ModelHub** entry and a Manage button, with no
per-role provider rows or direct-provider connection section in the managed profile.
59 related app tests, the app type check, production build and macOS arm64 package
pass. The installed `app.asar` matches the new package:
`0344f2523ff1e96bfd4c6c213348ce3d1493cadcd3cffafa532737b155103d0b`.

The fork was closed, backed up, replaced and reopened under the user's existing
replacement authorization; the official OpenCode process remained running. No
password was entered by the agent. The user's previously saved login restored
automatically after the full process restart. Manage opened native Hub settings,
which displayed the signed-in account and both roles' current models from the
authenticated management read. This accepts one real macOS encrypted-login restore,
not every account failure or multi-window scenario. No model selection was saved.
Private screenshots and accessibility state record both views outside the repository.

## Rollback

Keep an existing fork bundle before replacement. Restore that bundle after the
fork exits, keeping `profiles/desktop` and both dedicated role keys unchanged.
The official app is independent. Keep role-specific request credentials and
memory-tool isolation. Never restore global-memory access as a rollback shortcut.

### Installed desktop acceptance

With explicit approval, the fork bundle was backed up, replaced and reopened.
The Model Hub light UI and native upstream check visibly show v1.19.0. Actual
GUI ARONA → PRANA → ARONA messages keep one session URL and recall the preceding
reply. The UI reports approximately 2 / 6 / 2 seconds; these are displayed
values, separate from the CLI wall-clock measurements above.

Successful authenticated iframe management remains unverified. No browser
credentials were extracted.

### Login-recovery desktop acceptance — 2026-10-15

The installed `app.asar` SHA256 matches the build:
`66fec459d68bfef23ddbd8a0fa6d5cc7e69e78fbac545d5441c9520bec755b03`.
The separate official OpenCode app remained running unchanged.

In Settings → Model Hub, one fabricated username/password pair was submitted
once. The app displayed “用户名或密码错误，请重新输入。”, retained the username,
cleared the password and left the Open Model Hub button available. No iframe
was mounted. The upstream version check displayed v1.19.0.

This confirms the rejected-credentials flow in the installed repair bundle.
Successful administrator login remains unverified. Access-denied, network,
server-error, timeout and iframe-load-failure paths have unit-test coverage,
but were not exercised in this installed-app check. No saved administrator
credentials were read or changed. Screenshots, accessibility output and bundle
backups are retained privately and are not included in the repository.


## Shared projects and agent tools

Open the same project folder as Codex; project files and AGENTS.md do not need a
migration. The clients keep separate conversation and credential stores. Existing
file tools now recheck bytes after approval to preserve changes made by the other
client. This is optimistic conflict detection, not a cross-process transaction.
Role-specific foreground explore/worker helpers preserve memory scope; delegation
still requires user or project authorization. `/review` stays with the selected
role. See [capability coverage and limitations](project-agent-coverage.md) before
assuming that Codex cloud tools or account-connected Apps are portable.

The one-shot desktop build and synthetic Agent/Skill/MCP service checks passed;
the MCP checks used disabled endpoints and made no model API calls. The macOS
arm64 package was backed up, installed and reopened on 2026-10-16, leaving the
official app untouched. Its archive SHA-256 is
`c9bd8d9e72584562491659f732ad872b265deff482ac82ef5c75e5b682b3562b`.
Native accessibility state exposed the new extension controls and restored the
existing account login. Screenshots did not reliably follow the native settings
state, so visual layout, folder-picker interaction, live model delegation and
MCP connection/OAuth remain pending acceptance.

Server memory evaluation is delivered separately in hermes-infra PR4. Its initial
release was activated on 2026-10-16; selected source-backed mobile preferences
were reviewed, persisted, read using the owning role key and denied to the other
role. This does not establish future automatic extraction or universal recall;
those require separate live checks rather than desktop test results.
