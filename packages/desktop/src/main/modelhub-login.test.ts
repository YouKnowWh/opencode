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

test("wrong window, repeated challenges, proxies and cleared entries receive no credential", () => {
  const login = createModelHubLogin()
  login.set(1, { username: "admin", password: "test-only" })
  const url = "https://llm.alex045.xyz/hub/"
  expect(login.take(2, url, false, "basic")).toBeUndefined()
  expect(login.take(1, url, true, "basic")).toBeUndefined()
  expect(login.take(1, url, false, "digest")).toBeUndefined()
  expect(login.take(1, url, false, "basic")).toEqual({ username: "admin", password: "test-only" })
  expect(login.take(1, url, false, "basic")).toBeUndefined()
  login.set(1, { username: "admin", password: "replacement" })
  login.clear(1)
  expect(login.take(1, url, false, "basic")).toBeUndefined()
})
