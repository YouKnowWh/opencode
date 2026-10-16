import { createStore } from "solid-js/store"
import type { ModelHubLoginError, ModelHubLoginResult } from "./login"

/** Console admission and loading have separate failure paths; neither may leave a blank panel. */
export function createModelHubConsole(
  login?: (value: { username: string; password: string }) => Promise<ModelHubLoginResult>,
  timeout = 20_000,
) {
  const [state, setState] = createStore({
    opened: false,
    busy: false,
    loading: false,
    revision: 0,
    username: "",
    password: "",
    error: undefined as ModelHubLoginError | undefined,
  })
  let timer: ReturnType<typeof setTimeout> | undefined
  let generation = 0
  const fail = (error: ModelHubLoginError) => {
    clearTimeout(timer)
    setState({ opened: false, busy: false, loading: false, password: "", error })
  }
  const loaded = () => {
    clearTimeout(timer)
    setState("loading", false)
  }
  const refresh = () => {
    clearTimeout(timer)
    setState({ loading: true, revision: state.revision + 1 })
    timer = setTimeout(() => fail("timeout"), timeout)
  }
  const open = async () => {
    if (state.busy) return
    if (login && (!state.username || !state.password)) {
      setState("error", "invalid")
      return
    }
    const attempt = ++generation
    setState({ busy: true, error: undefined })
    const result = await (
      login?.({ username: state.username, password: state.password }) ?? Promise.resolve({ ok: true } as const)
    ).catch((): ModelHubLoginResult => ({ ok: false, error: "network" }))
    if (attempt !== generation) return
    if (!result.ok) return fail(result.error)
    setState({ opened: true, busy: false, password: "" })
    refresh()
  }
  const reset = () => {
    generation++
    clearTimeout(timer)
    setState({ opened: false, loading: false, busy: false, password: "", error: undefined })
  }
  return { state, setState, open, refresh, loaded, fail, reset, dispose: reset }
}
