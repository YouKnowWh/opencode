import { createStore } from "solid-js/store"
import { Show, onMount } from "solid-js"
import { useLanguage } from "@/context/language"
import { MODEL_HUB_URL } from "@/modelhub/roles"
import { usePlatform } from "@/context/platform"
import { upstreamVersion } from "@/modelhub/upstream"
import "./modelhub.css"

export function SettingsModelHub() {
  const language = useLanguage()
  const platform = usePlatform()
  const [state, setState] = createStore({
    opened: false,
    revision: 0,
    username: "",
    password: "",
    error: false,
    upstream: "",
    checking: false,
    upstreamFailed: false,
  })
  const checkUpstream = async () => {
    setState({ checking: true, upstreamFailed: false })
    await (platform.modelhubUpstreamVersion ? platform.modelhubUpstreamVersion() : upstreamVersion())
      .then((upstream) => setState("upstream", upstream))
      .catch(() => setState("upstreamFailed", true))
    setState("checking", false)
  }
  onMount(() => void checkUpstream())
  const open = async () => {
    setState("error", false)
    if (platform.modelhubLogin) {
      if (!state.username || !state.password) {
        setState("error", true)
        return
      }
      await platform.modelhubLogin({ username: state.username, password: state.password })
    }
    setState({ opened: true, password: "" })
  }
  return (
    <div data-component="modelhub-settings">
      <div class="mh-header">
        <div>
          <h2 class="text-lg font-semibold">{language.t("modelhub.title")}</h2>
          <p class="mt-1 text-sm text-gray-500">{language.t("modelhub.description")}</p>
        </div>
        <div class="mh-actions">
          <button
            type="button"
            title={language.t("modelhub.upstream")}
            aria-label={language.t("modelhub.upstream")}
            disabled={state.checking}
            onClick={() => void checkUpstream()}
          >
            {language.t("modelhub.upstream")}
          </button>
          <button
            type="button"
            title={language.t("modelhub.refresh")}
            disabled={!state.opened}
            aria-label={language.t("modelhub.refresh")}
            onClick={() => setState("revision", state.revision + 1)}
          >
            ↻
          </button>
          <button
            type="button"
            title={language.t("modelhub.browser")}
            aria-label={language.t("modelhub.browser")}
            onClick={() => platform.openExternal(MODEL_HUB_URL)}
          >
            ↗
          </button>
        </div>
      </div>
      <div class="mh-version" aria-live="polite">
        <span>
          {state.upstreamFailed
            ? language.t("modelhub.upstreamFailed")
            : state.upstream
              ? language.t("modelhub.upstreamNotice", { version: state.upstream })
              : language.t("modelhub.upstreamChecking")}
        </span>
        <button
          type="button"
          class="mh-link"
          onClick={() => platform.openExternal("https://github.com/anomalyco/opencode/releases")}
        >
          {language.t("modelhub.releases")}
        </button>
      </div>
      <Show
        when={state.opened}
        fallback={
          <div class="mh-login">
            <p>{language.t("modelhub.loginNotice")}</p>
            <Show when={platform.modelhubLogin}>
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  void open().catch(() => setState("error", true))
                }}
              >
                <input
                  autocomplete="username"
                  value={state.username}
                  placeholder={language.t("modelhub.username")}
                  aria-label={language.t("modelhub.username")}
                  onInput={(event) => setState("username", event.currentTarget.value)}
                />
                <input
                  type="password"
                  autocomplete="current-password"
                  value={state.password}
                  placeholder={language.t("modelhub.password")}
                  aria-label={language.t("modelhub.password")}
                  onInput={(event) => setState("password", event.currentTarget.value)}
                />
                <Show when={state.error}>
                  <p role="alert" class="text-sm text-red-500">
                    {language.t("modelhub.loginRequired")}
                  </p>
                </Show>
                <button type="submit" class="mh-primary">
                  {language.t("modelhub.open")}
                </button>
              </form>
            </Show>
            <Show when={!platform.modelhubLogin}>
              <button type="button" class="mh-primary" onClick={() => void open()}>
                {language.t("modelhub.open")}
              </button>
            </Show>
          </div>
        }
      >
        <Show keyed when={state.revision + 1}>
          {(revision) => (
            <iframe
              data-revision={revision}
              src={MODEL_HUB_URL}
              title={language.t("modelhub.title")}
              referrerPolicy="no-referrer"
              sandbox="allow-scripts allow-forms allow-same-origin allow-downloads"
              allow="clipboard-write"
            />
          )}
        </Show>
      </Show>
      <Show when={state.opened && platform.modelhubLogin}>
        <button class="mh-link mh-relogin" type="button" onClick={() => setState("opened", false)}>
          {language.t("modelhub.relogin")}
        </button>
      </Show>
    </div>
  )
}
