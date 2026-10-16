import { createStore } from "solid-js/store"
import { For, Show, createEffect, onCleanup, onMount } from "solid-js"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { SelectV2 } from "@opencode-ai/ui/v2/select-v2"
import { useLanguage } from "@/context/language"
import { MODEL_HUB_URL } from "@/modelhub/roles"
import { usePlatform } from "@/context/platform"
import { useModelHubAccount } from "@/modelhub/context"
import type { ModelHubSnapshot } from "@/modelhub/account"
import { upstreamVersion } from "@/modelhub/upstream"
import { createModelHubConsole } from "@/modelhub/console"
import { SettingsListV2 } from "./parts/list"
import { SettingsRowV2 } from "./parts/row"
import { ModelHubAccountSection } from "./modelhub-account"
import { ModelHubExtensionsSection } from "./modelhub-extensions"
import "./modelhub.css"

export function SettingsModelHub() {
  const language = useLanguage()
  const platform = usePlatform()
  const account = useModelHubAccount()
  const frame = createModelHubConsole()
  const [state, setState] = createStore({
    snapshot: undefined as ModelHubSnapshot | undefined,
    selected: {} as Record<string, string>,
    loading: false,
    saving: "",
    failed: false,
    upstream: "",
    checking: false,
    upstreamFailed: false,
  })
  let generation = 0
  const reload = async () => {
    if (!account.api || !account.state.signedIn) return
    const attempt = ++generation
    setState({ loading: true, failed: false })
    await account.api
      .snapshot()
      .then((snapshot) => {
        if (attempt !== generation) return
        setState({ snapshot, selected: Object.fromEntries(snapshot.roles.map((role) => [role.id, role.model])) })
      })
      .catch(() => {
        if (attempt === generation) setState("failed", true)
      })
    if (attempt === generation) setState("loading", false)
  }
  const select = async (roleId: string) => {
    if (!account.api || state.saving) return
    setState({ saving: roleId, failed: false })
    await account.api
      .selectModel({ roleId, model: state.selected[roleId] })
      .then(reload)
      .catch(() => setState("failed", true))
    setState("saving", "")
  }
  const checkUpstream = async () => {
    setState({ checking: true, upstreamFailed: false })
    await (platform.modelhubUpstreamVersion ? platform.modelhubUpstreamVersion() : upstreamVersion())
      .then((upstream) => setState("upstream", upstream))
      .catch(() => setState("upstreamFailed", true))
    setState("checking", false)
  }
  const openConsole = async () => {
    const result = await account.api?.prepare()
    if (!result?.ok) {
      frame.fail(result && !result.ok ? result.error : "credentials")
      return
    }
    await frame.open()
  }
  createEffect(() => {
    if (account.state.signedIn) {
      void reload()
      return
    }
    generation++
    setState({ snapshot: undefined, selected: {}, loading: false, failed: false })
    frame.reset()
  })
  onMount(() => {
    const off = platform.onModelhubError?.((error) => {
      if (frame.state.opened) frame.fail(error)
    })
    onCleanup(() => {
      generation++
      off?.()
      frame.dispose()
    })
  })
  return (
    <div data-component="modelhub-settings">
      <div class="settings-v2-tab-header">
        <h2 class="settings-v2-tab-title">{language.t("modelhub.title")}</h2>
      </div>
      <div class="settings-v2-tab-body">
        <ModelHubAccountSection />
        <Show when={account.state.signedIn}>
          <section class="settings-v2-section">
            <h3 class="settings-v2-section-title">{language.t("modelhub.roleModels")}</h3>
            <SettingsListV2>
              <For each={state.snapshot?.roles}>
                {(role) => (
                  <SettingsRowV2 title={role.name} description={role.alias}>
                    <div class="mh-role-controls">
                      <SelectV2
                        appearance="inline"
                        aria-label={language.t("modelhub.chooseModel", { role: role.name })}
                        options={
                          state.snapshot?.models
                            .filter(
                              (model) => model.capabilities.includes("llm") && role.allowedModels.includes(model.name),
                            )
                            .map((model) => model.name) ?? []
                        }
                        current={state.selected[role.id]}
                        label={(model) => model}
                        value={(model) => model}
                        placeholder={role.model || language.t("modelhub.unconfigured")}
                        disabled={!!state.saving || role.status === "draft"}
                        placement="bottom-end"
                        onSelect={(model) => model && setState("selected", role.id, model)}
                      />
                      <ButtonV2
                        variant="ghost"
                        disabled={!!state.saving || state.selected[role.id] === role.model || role.status === "draft"}
                        title={language.t("modelhub.applyRoleModel")}
                        onClick={() => void select(role.id)}
                      >
                        {language.t("common.save")}
                      </ButtonV2>
                    </div>
                  </SettingsRowV2>
                )}
              </For>
              <SettingsRowV2 title={language.t("modelhub.syncModels")} description={language.t("modelhub.modelScope")}>
                <ButtonV2 variant="ghost" disabled={state.loading} onClick={() => void reload()}>
                  {language.t("modelhub.refreshModels")}
                </ButtonV2>
              </SettingsRowV2>
            </SettingsListV2>
            <Show when={state.loading}>
              <p role="status">{language.t("modelhub.loading")}</p>
            </Show>
            <Show when={state.failed}>
              <p role="alert" class="mh-error">
                {language.t("modelhub.managementFailed")}
              </p>
            </Show>
          </section>
          <section class="settings-v2-section">
            <h3 class="settings-v2-section-title">{language.t("modelhub.management")}</h3>
            <SettingsListV2>
              <SettingsRowV2
                title={language.t("modelhub.console")}
                description={language.t("modelhub.consoleDescription")}
              >
                <div class="mh-row-actions">
                  <ButtonV2 variant="ghost" onClick={() => platform.openExternal(MODEL_HUB_URL)}>
                    {language.t("modelhub.browser")}
                  </ButtonV2>
                  <ButtonV2 variant="ghost" disabled={frame.state.loading} onClick={() => void openConsole()}>
                    {language.t("modelhub.open")}
                  </ButtonV2>
                </div>
              </SettingsRowV2>
            </SettingsListV2>
            <Show when={frame.state.error}>
              {(error) => (
                <p role="alert" class="mh-error">
                  {language.t(error() === "invalid" ? "modelhub.loginRequired" : `modelhub.error.${error()}`)}
                </p>
              )}
            </Show>
          </section>
        </Show>
        <ModelHubExtensionsSection />
        <section class="settings-v2-section">
          <h3 class="settings-v2-section-title">{language.t("modelhub.upstream")}</h3>
          <SettingsListV2>
            <SettingsRowV2
              title={language.t("modelhub.upstream")}
              description={
                state.upstreamFailed
                  ? language.t("modelhub.upstreamFailed")
                  : state.upstream
                    ? language.t("modelhub.upstreamNotice", { version: state.upstream })
                    : language.t("modelhub.upstreamDescription")
              }
            >
              <ButtonV2 variant="ghost" disabled={state.checking} onClick={() => void checkUpstream()}>
                {language.t("modelhub.checkUpdates")}
              </ButtonV2>
            </SettingsRowV2>
          </SettingsListV2>
        </section>
        <Show when={frame.state.opened}>
          <div class="mh-console-heading">
            <h3 class="settings-v2-section-title">{language.t("modelhub.console")}</h3>
            <ButtonV2 variant="ghost" onClick={frame.reset}>
              {language.t("common.close")}
            </ButtonV2>
          </div>
          <Show when={frame.state.loading}>
            <p role="status">{language.t("modelhub.loading")}</p>
          </Show>
          <Show keyed when={frame.state.revision + 1}>
            {(revision) => (
              <iframe
                data-revision={revision}
                src={MODEL_HUB_URL}
                title={language.t("modelhub.title")}
                onLoad={frame.loaded}
                onError={() => frame.fail("network")}
                referrerPolicy="no-referrer"
                sandbox="allow-scripts allow-forms allow-same-origin allow-downloads"
                allow="clipboard-write"
              />
            )}
          </Show>
        </Show>
      </div>
    </div>
  )
}
