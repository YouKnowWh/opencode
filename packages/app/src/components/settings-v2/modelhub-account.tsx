import { Show } from "solid-js"
import { createStore } from "solid-js/store"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { TextInputV2 } from "@opencode-ai/ui/v2/text-input-v2"
import { CheckboxV2 } from "@opencode-ai/ui/v2/checkbox-v2"
import { useLanguage } from "@/context/language"
import { useModelHubAccount } from "@/modelhub/context"
import type { ModelHubLoginError } from "@/modelhub/login"
import { SettingsListV2 } from "./parts/list"
import { SettingsRowV2 } from "./parts/row"

export function ModelHubAccountSection() {
  const account = useModelHubAccount()
  const language = useLanguage()
  const [form, setForm] = createStore({
    username: "",
    password: "",
    remember: true,
    busy: false,
    error: undefined as ModelHubLoginError | undefined,
  })
  const signIn = async () => {
    if (!account.api || form.busy) return
    if (!form.username || !form.password) {
      setForm("error", "invalid")
      return
    }
    setForm({ busy: true, error: undefined })
    const result = await account.api
      .signIn({ username: form.username, password: form.password, remember: form.remember })
      .catch(() => ({ ok: false as const, error: "network" as const }))
    setForm({ busy: false, password: "", error: result.ok ? undefined : result.error })
  }
  const signOut = async () => {
    if (!account.api || form.busy) return
    setForm({ busy: true, error: undefined })
    await account.api.signOut().catch(() => setForm("error", "storage"))
    setForm("busy", false)
  }
  return (
    <section class="settings-v2-section" data-component="modelhub-account">
      <h3 class="settings-v2-section-title">{language.t("modelhub.account")}</h3>
      <Show when={account.state.ready} fallback={<p role="status">{language.t("modelhub.signingIn")}</p>}>
        <Show when={account.api} fallback={<p>{language.t("modelhub.desktopRequired")}</p>}>
          <Show
            when={account.state.signedIn}
            fallback={
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  void signIn()
                }}
                aria-busy={form.busy}
              >
                <SettingsListV2>
                  <SettingsRowV2
                    title={language.t("modelhub.username")}
                    description={language.t("modelhub.accountScope")}
                  >
                    <TextInputV2
                      autocomplete="username"
                      aria-label={language.t("modelhub.username")}
                      value={form.username}
                      onInput={(event) => setForm("username", event.currentTarget.value)}
                      disabled={form.busy}
                    />
                  </SettingsRowV2>
                  <SettingsRowV2
                    title={language.t("modelhub.password")}
                    description={language.t("modelhub.loginRequired")}
                  >
                    <TextInputV2
                      type="password"
                      autocomplete="current-password"
                      aria-label={language.t("modelhub.password")}
                      value={form.password}
                      onInput={(event) => setForm("password", event.currentTarget.value)}
                      disabled={form.busy}
                    />
                  </SettingsRowV2>
                  <SettingsRowV2
                    title={language.t("modelhub.remember")}
                    description={language.t("modelhub.secureStorageNotice")}
                  >
                    <CheckboxV2
                      checked={form.remember}
                      onChange={(value) => setForm("remember", value)}
                      label={language.t("modelhub.remember")}
                      hideLabel
                      disabled={form.busy}
                    />
                  </SettingsRowV2>
                </SettingsListV2>
                <div class="mh-account-actions">
                  <Show when={account.state.remembered || account.state.error === "storage"}>
                    <ButtonV2 variant="ghost" disabled={form.busy} onClick={() => void signOut()}>
                      {language.t("modelhub.signOut")}
                    </ButtonV2>
                  </Show>
                  <ButtonV2 type="submit" variant="contrast" disabled={form.busy}>
                    {language.t(form.busy ? "modelhub.signingIn" : "modelhub.signIn")}
                  </ButtonV2>
                </div>
              </form>
            }
          >
            <SettingsListV2>
              <SettingsRowV2
                title={account.state.username ?? language.t("modelhub.account")}
                description={language.t(account.state.remembered ? "modelhub.remembered" : "modelhub.accountScope")}
              >
                <ButtonV2 variant="ghost" disabled={form.busy} onClick={() => void signOut()}>
                  {language.t("modelhub.signOut")}
                </ButtonV2>
              </SettingsRowV2>
            </SettingsListV2>
          </Show>
        </Show>
        <Show when={form.error ?? account.state.error}>
          {(error) => (
            <p role="alert" class="mh-error">
              {language.t(error() === "invalid" ? "modelhub.loginRequired" : `modelhub.error.${error()}`)}
            </p>
          )}
        </Show>
      </Show>
    </section>
  )
}

export function SettingsModelHubAccount() {
  const language = useLanguage()
  return (
    <>
      <div class="settings-v2-tab-header">
        <h2 class="settings-v2-tab-title">{language.t("modelhub.account")}</h2>
      </div>
      <div class="settings-v2-tab-body">
        <ModelHubAccountSection />
      </div>
    </>
  )
}
