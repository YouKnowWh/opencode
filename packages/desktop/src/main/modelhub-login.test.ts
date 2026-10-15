import { expect, test } from "bun:test"
import { createModelHubLogin, isModelHubDocument } from "./modelhub-login"

test("console login is restricted to the HTTPS console, never proxy or model endpoints", () => {
  expect(isModelHubDocument("https://llm.alex045.xyz/hub/")).toBe(true)
  for (const url of [
    "http://llm.alex045.xyz/hub/",
    "https://llm.alex045.xyz.evil.test/hub/",
    "https://llm.alex045.xyz:444/hub/",
    "https://llm.alex045.xyz/v1/models",
    "https://user:pass@llm.alex045.xyz/hub/",
  ])
    expect(isModelHubDocument(url)).toBe(false)
})

test("wrong window, repeated challenges, proxies and cleared entries receive no credential", async () => {
  const login = createModelHubLogin(async () => new Response(null, { status: 200 }))
  await login.set(1, { username: "admin", password: "test-only" })
  const url = "https://llm.alex045.xyz/hub/"
  expect(login.take(2, url, false, "basic")).toBeUndefined()
  expect(login.take(1, url, true, "basic")).toBeUndefined()
  expect(login.take(1, url, false, "digest")).toBeUndefined()
  expect(login.take(1, url, false, "basic")).toEqual({ username: "admin", password: "test-only" })
  expect(login.take(1, url, false, "basic")).toBeUndefined()
  await login.set(1, { username: "admin", password: "replacement" })
  login.clear(1)
  expect(login.take(1, url, false, "basic")).toBeUndefined()
})

test("a rejected password never opens the console or becomes an iframe credential", async () => {
  const login = createModelHubLogin(async () => new Response(null, { status: 401 }))
  expect(await login.set(1, { username: "test-user", password: "wrong-password" })).toEqual({
    ok: false,
    error: "credentials",
  })
  expect(login.take(1, "https://llm.alex045.xyz/hub/", false, "basic")).toBeUndefined()
})

test("status and network failures are safe typed results and leave no credential", async () => {
  for (const [status, error] of [
    [403, "forbidden"],
    [302, "unavailable"],
    [429, "unavailable"],
    [500, "unavailable"],
  ] as const) {
    const login = createModelHubLogin(async () => new Response(null, { status }))
    expect(await login.set(1, { username: "user", password: "wrong" })).toEqual({ ok: false, error })
    expect(login.take(1, "https://llm.alex045.xyz/hub/", false, "basic")).toBeUndefined()
  }
  const login = createModelHubLogin(async () => {
    throw new Error("must not leak private upstream error")
  })
  expect(await login.set(1, { username: "user", password: "private" })).toEqual({ ok: false, error: "network" })
})

test("login probes only the fixed HTTPS console and never follows redirects or shares cookies", async () => {
  const login = createModelHubLogin(async (url, options) => {
    expect(url).toBe("https://llm.alex045.xyz/hub/")
    expect(options?.redirect).toBe("manual")
    expect(options?.credentials).toBe("omit")
    expect(options?.cache).toBe("no-store")
    expect(new Headers(options?.headers).get("Authorization")).toBe(
      `Basic ${Buffer.from("test-user:test-pass").toString("base64")}`,
    )
    return new Response(null, { status: 200 })
  })
  expect(await login.set(1, { username: "test-user", password: "test-pass" })).toEqual({ ok: true })
})

test("timeout and superseded attempts cannot store stale credentials", async () => {
  const login = createModelHubLogin(
    (_url, options) =>
      new Promise((_, reject) => {
        options?.signal?.addEventListener("abort", () => reject(options.signal?.reason), { once: true })
      }),
    5,
  )
  expect(await login.set(1, { username: "user", password: "private" })).toEqual({ ok: false, error: "timeout" })
  expect(login.take(1, "https://llm.alex045.xyz/hub/", false, "basic")).toBeUndefined()
  const old = login.set(1, { username: "old", password: "private" })
  expect(
    await login.set(1, { username: "new", password: "private" }, async () => new Response(null, { status: 200 })),
  ).toEqual({ ok: true })
  expect(await old).toEqual({ ok: false, error: "network" })
  expect(login.take(1, "https://llm.alex045.xyz/hub/", false, "basic")?.username).toBe("new")
})

test("invalid input is rejected before any request", async () => {
  const login = createModelHubLogin(async () => {
    throw new Error("should not request")
  })
  for (const username of ["", "user:other", "user\nheader"]) {
    expect(await login.set(1, { username, password: "private" })).toEqual({ ok: false, error: "invalid" })
  }
})
