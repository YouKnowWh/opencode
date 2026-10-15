import type { ModelHubLoginResult, ModelHubLoginError } from "../../../app/src/modelhub/login"

export function isModelHubDocument(value?: string) {
  if (!value) return false
  const url = URL.parse(value)
  return (
    !!url &&
    url.origin === "https://llm.alex045.xyz" &&
    url.pathname.startsWith("/hub/") &&
    !url.username &&
    !url.password
  )
}

export function modelHubHttpError(status: number): ModelHubLoginError | undefined {
  if (status === 401) return "credentials"
  if (status === 403) return "forbidden"
  if (status < 200 || status >= 300) return "unavailable"
}

/** Verify before mounting the iframe. Never follow redirects with credentials. */
export function createModelHubLogin(
  fetcher: (url: string, options: RequestInit) => Promise<Response> = fetch,
  timeout = 15_000,
) {
  const entries = new Map<
    number,
    {
      credential?: { username: string; password: string }
      used: boolean
      controller: AbortController
    }
  >()
  return {
    async set(
      owner: number,
      value: { username: string; password: string },
      request: (url: string, options: RequestInit) => Promise<Response> = fetcher,
    ): Promise<ModelHubLoginResult> {
      entries.get(owner)?.controller.abort()
      entries.delete(owner)
      if (
        !value ||
        typeof value.username !== "string" ||
        typeof value.password !== "string" ||
        !value.username ||
        !value.password ||
        value.username.length > 256 ||
        value.password.length > 4096 ||
        /[\r\n:]/.test(value.username)
      )
        return { ok: false, error: "invalid" }
      const entry = {
        used: false,
        controller: new AbortController(),
        credential: undefined as { username: string; password: string } | undefined,
      }
      entries.set(owner, entry)
      const deadline = setTimeout(() => entry.controller.abort(new DOMException("Timed out", "TimeoutError")), timeout)
      try {
        const response = await request("https://llm.alex045.xyz/hub/", {
          headers: {
            Authorization: `Basic ${Buffer.from(`${value.username}:${value.password}`, "utf8").toString("base64")}`,
          },
          redirect: "manual",
          credentials: "omit",
          cache: "no-store",
          signal: entry.controller.signal,
        })
        void response.body?.cancel().catch(() => {})
        if (entries.get(owner) !== entry) return { ok: false, error: "network" }
        if (entry.controller.signal.aborted)
          return {
            ok: false,
            error: entry.controller.signal.reason?.name === "TimeoutError" ? "timeout" : "network",
          }
        const error = modelHubHttpError(response.status)
        if (error) {
          entries.delete(owner)
          return { ok: false, error }
        }
        entry.credential = { username: value.username, password: value.password }
        return { ok: true }
      } catch {
        if (entries.get(owner) === entry) entries.delete(owner)
        return { ok: false, error: entry.controller.signal.reason?.name === "TimeoutError" ? "timeout" : "network" }
      } finally {
        clearTimeout(deadline)
      }
    },
    take(owner: number, url: string, proxy: boolean, scheme: string) {
      const entry = entries.get(owner)
      if (!entry?.credential || entry.used || proxy || scheme.toLowerCase() !== "basic" || !isModelHubDocument(url))
        return
      entry.used = true
      const credential = entry.credential
      entry.credential = undefined
      return credential
    },
    clear(owner: number) {
      entries.get(owner)?.controller.abort()
      entries.delete(owner)
    },
  }
}

export const modelHubLogin = createModelHubLogin()
