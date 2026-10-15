import { createSimpleContext } from "@opencode-ai/ui/context"
import { createStore } from "solid-js/store"
import { onMount, onCleanup } from "solid-js"
import { usePlatform } from "@/context/platform"
import type { ModelHubAccountState } from "./account"

export const { use: useModelHubAccount, provider: ModelHubAccountProvider } = createSimpleContext({
  name: "ModelHubAccount",
  init: () => {
    const api = usePlatform().modelhubAccount
    const [state, setState] = createStore<ModelHubAccountState & { ready: boolean }>({
      signedIn: false,
      remembered: false,
      secureStorage: false,
      ready: !api,
    })
    onMount(() => {
      if (!api) return
      // Subscribe first; a restored account may change while the initial request is pending.
      let revision = 0
      const off = api.subscribe((value) => {
        revision++
        setState({ ...value, ready: true })
      })
      const initial = revision
      void api
        .state()
        .then((value) => {
          if (initial === revision) setState({ ...value, ready: true })
        })
        .catch(() => {
          if (initial === revision) setState({ ready: true, error: "network" })
        })
      onCleanup(() => {
        revision++
        off()
      })
    })
    return { state, api }
  },
})
