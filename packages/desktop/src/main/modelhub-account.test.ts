import { expect, test } from "bun:test"
import { createModelHubAccount, type ModelHubVault } from "./modelhub-account"
import type { ModelHubAccountState } from "../../../app/src/modelhub/account"

function fixture() {
  let saved: { username: string; password: string } | undefined
  const events: ModelHubAccountState[] = []
  const vault: ModelHubVault = {
    available: () => true,
    read: async () => saved,
    write: async (value) => {
      saved = value
    },
    clear: async () => {
      saved = undefined
    },
  }
  const make = (verify = async () => ({ ok: true as const })) =>
    createModelHubAccount({ verify, vault, changed: (value) => events.push(value) })
  return { vault, make, events, saved: () => saved }
}
const login = { username: "fixture-user", password: "private-fixture-password", remember: true }
const url = "https://llm.alex045.xyz/hub/"

test("one login is shared by prepared windows; closing a window preserves account and restart restores it", async () => {
  const f = fixture()
  const account = f.make()
  expect(await account.signIn(login)).toEqual({ ok: true })
  expect(await account.prepare(1)).toEqual({ ok: true })
  expect(await account.prepare(2)).toEqual({ ok: true })
  expect(account.take(1, url, false, "basic")?.username).toBe(login.username)
  account.close(1)
  expect((await account.state()).signedIn).toBe(true)
  expect(account.take(2, url, false, "basic")?.username).toBe(login.username)
  expect(await f.make().state()).toMatchObject({ signedIn: true, username: login.username, remembered: true })
  expect(JSON.stringify(f.events)).not.toContain(login.password)
  expect(JSON.stringify(await account.state())).not.toContain("Basic")
})

test("sign out clears saved login and every prepared window; restart stays signed out", async () => {
  const f = fixture()
  const account = f.make()
  await account.signIn(login)
  await account.prepare(1)
  await account.signOut()
  expect(account.take(1, url, false, "basic")).toBeUndefined()
  expect(f.saved()).toBeUndefined()
  expect((await f.make().state()).signedIn).toBe(false)
})

test("queued startup restore cannot undo a same-tick sign out", async () => {
  const f = fixture()
  await f.make().signIn(login)
  const account = f.make()
  const restore = account.state()
  const logout = account.signOut()
  await Promise.all([restore, logout])
  expect(await account.state()).toMatchObject({ signedIn: false, remembered: false })
  expect(f.saved()).toBeUndefined()
})

test("malformed IPC input is rejected before verification or storage", async () => {
  const account = fixture().make()
  for (const input of [undefined, {}, { ...login, remember: "true" }, { ...login, username: "a:b" }]) {
    expect(await account.signIn(input as typeof login)).toEqual({ ok: false, error: "invalid" })
  }
  expect((await account.state()).signedIn).toBe(false)
})

test("unreadable encrypted storage is a visible error, not a silent empty account", async () => {
  const f = fixture()
  f.vault.read = async () => {
    throw new Error("private path")
  }
  expect(await f.make().state()).toMatchObject({ signedIn: false, error: "storage" })
})

test("application login never authorizes unprepared windows, model endpoints, other origins or proxies", async () => {
  const account = fixture().make()
  await account.signIn(login)
  await account.prepare(1)
  expect(account.take(2, url, false, "basic")).toBeUndefined()
  expect(account.take(1, "https://llm.alex045.xyz/v1/models", false, "basic")).toBeUndefined()
  expect(account.take(1, "https://evil.test/hub/", false, "basic")).toBeUndefined()
  expect(account.take(1, url, true, "basic")).toBeUndefined()
  expect(account.take(1, url, false, "basic")).toEqual({ username: login.username, password: login.password })
  expect(account.take(1, url, false, "basic")).toBeUndefined()
})

test("unavailable secure storage rejects remembering rather than silently saving plaintext", async () => {
  const f = fixture()
  f.vault.available = () => false
  const account = f.make()
  expect(await account.signIn(login)).toEqual({ ok: false, error: "storage" })
  expect(f.saved()).toBeUndefined()
  expect(await account.signIn({ ...login, remember: false })).toEqual({ ok: true })
  expect(f.saved()).toBeUndefined()
})

test("disk failure does not report successful persistent sign in", async () => {
  const f = fixture()
  f.vault.write = async () => {
    throw new Error("private disk path")
  }
  const account = f.make()
  expect(await account.signIn(login)).toEqual({ ok: false, error: "storage" })
  expect((await account.state()).signedIn).toBe(false)
})

test("late login cannot reauthenticate after sign out", async () => {
  const f = fixture()
  let resolve: ((value: { ok: true }) => void) | undefined
  const account = createModelHubAccount({
    verify: () =>
      new Promise((r) => {
        resolve = r
      }),
    vault: f.vault,
    changed: () => {},
  })
  const pending = account.signIn(login)
  await new Promise((r) => setTimeout(r, 0))
  const logout = account.signOut()
  resolve!({ ok: true })
  expect(await pending).toEqual({ ok: false, error: "network" })
  await logout
  expect(f.saved()).toBeUndefined()
  expect((await account.state()).signedIn).toBe(false)
})

test("rejected restore removes invalid saved login; offline restore retains encrypted login for next startup", async () => {
  const f = fixture()
  await f.make().signIn(login)
  const offline = createModelHubAccount({
    verify: async () => ({ ok: false, error: "network" }),
    vault: f.vault,
    changed: () => {},
  })
  expect(await offline.state()).toMatchObject({ signedIn: false, remembered: true, error: "network" })
  expect(f.saved()).toBeDefined()
  const rejected = createModelHubAccount({
    verify: async () => ({ ok: false, error: "credentials" }),
    vault: f.vault,
    changed: () => {},
  })
  expect(await rejected.state()).toMatchObject({ signedIn: false, remembered: false, error: "credentials" })
  expect(f.saved()).toBeUndefined()
})

test("a stale unauthorized response cannot log out a newly signed-in account", async () => {
  const f = fixture()
  const account = f.make()
  await account.signIn(login)
  const old = await account.authorization()
  await account.signIn({ ...login, username: "replacement" })
  await account.rejected(old, "credentials")
  expect((await account.state()).username).toBe("replacement")
  await account.rejected(await account.authorization(), "credentials")
  expect((await account.state()).signedIn).toBe(false)
  expect(f.saved()).toBeUndefined()
})

test("forbidden management access keeps remembered credentials and reports the policy error", async () => {
  const f = fixture()
  const account = f.make()
  await account.signIn(login)
  await account.rejected(await account.authorization(), "forbidden")
  expect(await account.state()).toMatchObject({ signedIn: true, remembered: true, error: "forbidden" })
  expect(f.saved()).toBeDefined()
  const restored = createModelHubAccount({
    verify: async () => ({ ok: false, error: "forbidden" }),
    vault: f.vault,
    changed: () => {},
  })
  expect(await restored.state()).toMatchObject({ signedIn: false, remembered: true, error: "forbidden" })
  expect(f.saved()).toBeDefined()
})
