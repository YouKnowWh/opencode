import type { ModelHubAccountState } from "../../../app/src/modelhub/account"
import type { ModelHubLoginError, ModelHubLoginResult } from "../../../app/src/modelhub/login"
import { isModelHubDocument } from "./modelhub-login"

type Credential = { username: string; password: string }
export type ModelHubVault = {
  available(): boolean
  read(): Promise<Credential | undefined>
  write(value: Credential): Promise<void>
  clear(): Promise<void>
}

/** One account per application, never per project, role or settings mount. */
export function createModelHubAccount(deps: {
  verify(value: Credential): Promise<ModelHubLoginResult>
  vault: ModelHubVault
  changed(state: ModelHubAccountState): void
}) {
  let credential: Credential | undefined
  let remembered = false
  let savedUsername: string | undefined
  let error: ModelHubLoginError | undefined
  let generation = 0
  let initialized: Promise<void> | undefined
  const windows = new Set<number>()
  let mutation: Promise<unknown> = Promise.resolve()
  const serialize = <T>(run: () => Promise<T>): Promise<T> => {
    const task = mutation.then(run, run)
    mutation = task.catch(() => {})
    return task
  }
  const state = (): ModelHubAccountState => ({
    signedIn: !!credential,
    username: credential?.username ?? savedUsername,
    remembered,
    secureStorage: deps.vault.available(),
    error,
  })
  const notify = () => deps.changed(state())
  const initialize = () => {
    if (initialized) return initialized
    const attempt = generation
    return (initialized = serialize(async () => {
      if (attempt !== generation) return
      const saved = await deps.vault.read().catch(() => {
        if (attempt === generation) error = "storage"
        return undefined
      })
      if (error === "storage" && attempt === generation) notify()
      if (!saved || attempt !== generation) return
      savedUsername = saved.username
      remembered = true
      const result = await deps.verify(saved)
      if (attempt !== generation) return
      if (result.ok) {
        credential = saved
        remembered = true
        error = undefined
        notify()
        return
      }
      error = result.error
      // Keep encrypted login during transient offline failures; discard rejected credentials.
      if (result.error === "credentials" || result.error === "invalid") {
        remembered = false
        await deps.vault.clear()
      }
      notify()
    }))
  }
  return {
    async state() {
      await initialize()
      return state()
    },
    async signIn(value: Credential & { remember: boolean }): Promise<ModelHubLoginResult> {
      if (
        !value ||
        typeof value.username !== "string" ||
        typeof value.password !== "string" ||
        typeof value.remember !== "boolean" ||
        !value.username ||
        !value.password ||
        value.username.length > 256 ||
        value.password.length > 4096 ||
        /[\r\n:]/.test(value.username)
      )
        return { ok: false, error: "invalid" }
      const attempt = ++generation
      return serialize(async () => {
        if (value.remember && !deps.vault.available()) return { ok: false, error: "storage" }
        const result = await deps.verify(value)
        if (attempt !== generation) return { ok: false, error: "network" }
        if (!result.ok) return result
        try {
          if (value.remember) await deps.vault.write({ username: value.username, password: value.password })
          if (!value.remember) await deps.vault.clear()
        } catch {
          return { ok: false, error: "storage" }
        }
        if (attempt !== generation) {
          await deps.vault.clear()
          return { ok: false, error: "network" }
        }
        credential = { username: value.username, password: value.password }
        savedUsername = value.username
        remembered = value.remember
        error = undefined
        windows.clear()
        initialized = Promise.resolve()
        notify()
        return { ok: true } as const
      })
    },
    async signOut() {
      generation++
      credential = undefined
      savedUsername = undefined
      remembered = false
      error = undefined
      windows.clear()
      initialized = Promise.resolve()
      // Clear memory even if disk deletion fails; surface failure rather than silently restoring on restart.
      notify()
      await serialize(() => deps.vault.clear())
    },
    async prepare(owner: number): Promise<ModelHubLoginResult> {
      await initialize()
      if (!credential) return { ok: false, error: error ?? "credentials" }
      windows.add(owner)
      return { ok: true }
    },
    take(owner: number, url: string, proxy: boolean, scheme: string) {
      if (!credential || !windows.has(owner) || proxy || scheme.toLowerCase() !== "basic" || !isModelHubDocument(url))
        return
      windows.delete(owner)
      return { ...credential }
    },
    close(owner: number) {
      windows.delete(owner)
    },
    async rejected(authorization: string, errorValue: ModelHubLoginError) {
      if (
        !credential ||
        authorization !==
          `Basic ${Buffer.from(`${credential.username}:${credential.password}`, "utf8").toString("base64")}`
      )
        return
      if (errorValue === "forbidden") {
        error = errorValue
        notify()
        return
      }
      if (errorValue !== "credentials") return
      generation++
      credential = undefined
      savedUsername = undefined
      remembered = false
      error = errorValue
      windows.clear()
      notify()
      await serialize(() => deps.vault.clear())
    },
    async authorization() {
      await initialize()
      if (!credential) throw new Error("Model Hub sign-in required")
      return `Basic ${Buffer.from(`${credential.username}:${credential.password}`, "utf8").toString("base64")}`
    },
  }
}
