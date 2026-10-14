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

/** Window-owned credentials, held only in memory, for this console's Basic challenge. */
export function createModelHubLogin() {
  const entries = new Map<number, { username: string; password: string; used: boolean }>()
  return {
    set(owner: number, value: { username: string; password: string }) {
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
        throw new Error("Invalid console login")
      entries.set(owner, { ...value, used: false })
    },
    take(owner: number, url: string, proxy: boolean, scheme: string) {
      const entry = entries.get(owner)
      if (!entry || entry.used || proxy || scheme.toLowerCase() !== "basic" || !isModelHubDocument(url)) return
      entry.used = true
      return { username: entry.username, password: entry.password }
    },
    clear(owner: number) {
      entries.delete(owner)
    },
  }
}

export const modelHubLogin = createModelHubLogin()
