import { createStore } from "solid-js/store"
import { Show, onMount, onCleanup } from "solid-js"
import { useLanguage } from "@/context/language"
import { MODEL_HUB_URL } from "@/modelhub/roles"
import { usePlatform } from "@/context/platform"
import { upstreamVersion } from "@/modelhub/upstream"
import { createModelHubConsole } from "@/modelhub/console"
import "./modelhub.css"

export function SettingsModelHub() {
  const language = useLanguage()
  const platform = usePlatform()
  const console = createModelHubConsole(platform.modelhubLogin)
  const state = console.state
  const setState = console.setState
  const [version, setVersion] = createStore({
    upstream: "",
    checking: false,
    upstreamFailed: false,
  })
  const checkUpstream = async () => {
    setVersion({ checking: true, upstreamFailed: false })
    await (platform.modelhubUpstreamVersion ? platform.modelhubUpstreamVersion() : upstreamVersion())
      .then((upstream) => setVersion("upstream", upstream))
      .catch(() => setVersion("upstreamFailed", true))
    setVersion("checking", false)
  }
  onMount(() => {
    void checkUpstream()
    const unsubscribe = platform.onModelhubError?.((error) => {
      if (state.opened) console.fail(error)
    })
    onCleanup(() => {
      unsubscribe?.()
      console.dispose()
    })
  })
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
            disabled={version.checking}
            onClick={() => void checkUpstream()}
          >
            {language.t("modelhub.upstream")}
          </button>
          <button
            type="button"
            title={language.t("modelhub.refresh")}
            disabled={!state.opened}
            aria-label={language.t("modelhub.refresh")}
            onClick={console.refresh}
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
          {version.upstreamFailed
            ? language.t("modelhub.upstreamFailed")
            : version.upstream
              ? language.t("modelhub.upstreamNotice", { version: version.upstream })
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
          <div class="mh-login" aria-busy={state.busy}>
            <p>{language.t("modelhub.loginNotice")}</p>
            <Show when={platform.modelhubLogin}>
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  void console.open()
                }}
              >
                <input
                  autocomplete="username"
                  disabled={state.busy}
                  value={state.username}
                  placeholder={language.t("modelhub.username")}
                  aria-label={language.t("modelhub.username")}
                  onInput={(event) => setState("username", event.currentTarget.value)}
                />
                <input
                  type="password"
                  autocomplete="current-password"
                  disabled={state.busy}
                  value={state.password}
                  placeholder={language.t("modelhub.password")}
                  aria-label={language.t("modelhub.password")}
                  onInput={(event) => setState("password", event.currentTarget.value)}
                />
                <Show when={state.error}>
                  <p role="alert" class="text-sm text-red-500">
                    {language.t(
                      state.error === "invalid" ? "modelhub.loginRequired" : `modelhub.error.${state.error!}`,
                    )}
                  </p>
                </Show>
                <button type="submit" class="mh-primary" disabled={state.busy}>
                  {language.t(state.busy ? "modelhub.signingIn" : "modelhub.open")}
                </button>
              </form>
            </Show>
            <Show when={!platform.modelhubLogin}>
              <button type="button" class="mh-primary" onClick={() => void console.open()}>
                {language.t("modelhub.open")}
              </button>
            </Show>
          </div>
        }
      >
        <Show when={state.loading}>
          <p class="mh-loading" role="status">
            {language.t("modelhub.loading")}
          </p>
        </Show>
        <Show keyed when={state.revision + 1}>
          {(revision) => (
            <iframe
              data-revision={revision}
              src={MODEL_HUB_URL}
              onLoad={console.loaded}
              onError={() => console.fail("network")}
              title={language.t("modelhub.title")}
              referrerPolicy="no-referrer"
              sandbox="allow-scripts allow-forms allow-same-origin allow-downloads"
              allow="clipboard-write"
            />
          )}
        </Show>
      </Show>
      <Show when={state.opened && platform.modelhubLogin}>
        <button class="mh-link mh-relogin" type="button" onClick={console.reset}>
          {language.t("modelhub.relogin")}
        </button>
      </Show>
    </div>
  )
}
