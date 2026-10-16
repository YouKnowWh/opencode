import { For, Show, onMount } from "solid-js"
import { createStore } from "solid-js/store"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { TextInputV2 } from "@opencode-ai/ui/v2/text-input-v2"
import { usePlatform } from "@/context/platform"
import { useLanguage } from "@/context/language"
import type { ModelHubExtensions } from "@/modelhub/extensions"
import { SettingsListV2 } from "./parts/list"
import { SettingsRowV2 } from "./parts/row"

export function ModelHubExtensionsSection() {
  const platform = usePlatform()
  const language = useLanguage()
  const [state, setState] = createStore({
    value: { revision: "", skillsPaths: [], mcp: [] } as ModelHubExtensions,
    name: "",
    url: "",
    busy: false,
    failed: false,
    saved: false,
    ready: false,
  })
  onMount(() => {
    void platform.modelhubExtensions
      ?.get()
      .then((value) => setState({ value, ready: true }))
      .catch(() => setState("failed", true))
  })
  const save = async (value: ModelHubExtensions) => {
    if (!platform.modelhubExtensions || state.busy) return
    setState({ busy: true, failed: false, saved: false })
    await platform.modelhubExtensions
      .save(value)
      .then((value) => setState({ value, saved: true, name: "", url: "" }))
      .catch(async () => {
        setState("failed", true)
        const current = await platform.modelhubExtensions?.get().catch(() => undefined)
        if (current) setState("value", current)
      })
    setState("busy", false)
  }
  const addSkills = async () => {
    if (platform.platform !== "desktop") return
    const selected = await platform.openDirectoryPickerDialog({
      multiple: true,
      title: language.t("modelhub.extensions.skills"),
    })
    if (!selected) return
    await save({
      ...state.value,
      skillsPaths: [...state.value.skillsPaths, ...(Array.isArray(selected) ? selected : [selected])],
    })
  }
  return (
    <Show when={platform.modelhubExtensions}>
      <section class="settings-v2-section">
        <h3 class="settings-v2-section-title">{language.t("modelhub.extensions.title")}</h3>
        <SettingsListV2>
          <SettingsRowV2
            title={language.t("modelhub.extensions.project")}
            description={language.t("modelhub.extensions.projectDescription")}
          >
            <span>{language.t("modelhub.extensions.enabled")}</span>
          </SettingsRowV2>
          <SettingsRowV2
            title={language.t("modelhub.extensions.skills")}
            description={language.t("modelhub.extensions.skillsDescription")}
          >
            <ButtonV2 variant="ghost" disabled={!state.ready || state.busy} onClick={() => void addSkills()}>
              {language.t("modelhub.extensions.add")}
            </ButtonV2>
          </SettingsRowV2>
          <For each={state.value.skillsPaths}>
            {(directory) => (
              <SettingsRowV2 title={directory} description="">
                <ButtonV2
                  variant="ghost"
                  disabled={state.busy}
                  aria-label={language.t("modelhub.extensions.removePath", { path: directory })}
                  onClick={() =>
                    void save({
                      ...state.value,
                      skillsPaths: state.value.skillsPaths.filter((entry) => entry !== directory),
                    })
                  }
                >
                  {language.t("modelhub.extensions.remove")}
                </ButtonV2>
              </SettingsRowV2>
            )}
          </For>
          <For each={state.value.mcp}>
            {(entry) => (
              <SettingsRowV2 title={entry.name} description={entry.url}>
                <ButtonV2
                  variant="ghost"
                  disabled={state.busy}
                  aria-label={language.t("modelhub.extensions.removePath", { path: entry.name })}
                  onClick={() =>
                    void save({ ...state.value, mcp: state.value.mcp.filter((item) => item.name !== entry.name) })
                  }
                >
                  {language.t("modelhub.extensions.remove")}
                </ButtonV2>
              </SettingsRowV2>
            )}
          </For>
        </SettingsListV2>
        <form
          class="mh-extension-form"
          onSubmit={(event) => {
            event.preventDefault()
            void save({
              ...state.value,
              mcp: [...state.value.mcp, { name: state.name, url: state.url, enabled: true }],
            })
          }}
        >
          <TextInputV2
            required
            aria-label={language.t("modelhub.extensions.mcpName")}
            placeholder={language.t("modelhub.extensions.mcpName")}
            value={state.name}
            onInput={(event) => setState("name", event.currentTarget.value)}
            disabled={!state.ready || state.busy}
          />
          <TextInputV2
            required
            type="url"
            aria-label={language.t("modelhub.extensions.mcpUrl")}
            placeholder={language.t("modelhub.extensions.mcpUrl")}
            value={state.url}
            onInput={(event) => setState("url", event.currentTarget.value)}
            disabled={!state.ready || state.busy}
          />
          <ButtonV2 type="submit" variant="ghost" disabled={!state.ready || state.busy}>
            {language.t("modelhub.extensions.addMcp")}
          </ButtonV2>
        </form>
        <p>{language.t("modelhub.extensions.mcpDescription")}</p>
        <Show when={state.saved}>
          <p role="status">{language.t("modelhub.extensions.saved")}</p>
        </Show>
        <Show when={state.failed}>
          <p role="alert" class="mh-error">
            {language.t("modelhub.extensions.failed")}
          </p>
        </Show>
      </section>
    </Show>
  )
}
