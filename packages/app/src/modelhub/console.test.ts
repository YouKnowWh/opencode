import { expect, test } from "bun:test"
import { createModelHubConsole } from "./console"
import type { ModelHubLoginResult } from "./login"

test("rejected passwords keep the retry form and username, never mount the iframe", async () => {
  let accept = false
  const panel = createModelHubConsole(async () => (accept ? { ok: true } : { ok: false, error: "credentials" }))
  panel.setState({ username: "test-user", password: "wrong" })
  await panel.open()
  expect(panel.state.opened).toBe(false)
  expect(panel.state.error).toBe("credentials")
  expect(panel.state.username).toBe("test-user")
  expect(panel.state.password).toBe("")
  expect(panel.state.busy).toBe(false)
  accept = true
  panel.setState("password", "replacement")
  await panel.open()
  expect(panel.state.opened).toBe(true)
  expect(panel.state.loading).toBe(true)
  expect(panel.state.error).toBeUndefined()
  panel.loaded()
  expect(panel.state.loading).toBe(false)
  panel.dispose()
})

test("pending validation does not open the iframe or submit twice", async () => {
  const resolvers: ((value: ModelHubLoginResult) => void)[] = []
  const panel = createModelHubConsole(() => new Promise((resolve) => resolvers.push(resolve)))
  panel.setState({ username: "test-user", password: "wrong" })
  const first = panel.open()
  await panel.open()
  expect(resolvers).toHaveLength(1)
  expect(panel.state.opened).toBe(false)
  expect(panel.state.busy).toBe(true)
  panel.dispose()
  resolvers[0]({ ok: true })
  await first
  expect(panel.state.opened).toBe(false)
})

test("network exceptions and frame load failures return to a usable login form", async () => {
  const panel = createModelHubConsole(async () => {
    throw new Error("private transport details")
  })
  panel.setState({ username: "user", password: "private" })
  await panel.open()
  expect(panel.state.error).toBe("network")
  expect(panel.state.opened).toBe(false)
  for (const error of ["credentials", "forbidden", "timeout", "network", "unavailable"] as const) {
    panel.setState("opened", true)
    panel.fail(error)
    expect(panel.state.opened).toBe(false)
    expect(panel.state.error).toBe(error)
    expect(panel.state.username).toBe("user")
  }
  panel.dispose()
})

test("an iframe that never loads times out instead of staying blank", async () => {
  const panel = createModelHubConsole(async () => ({ ok: true }), 5)
  panel.setState({ username: "user", password: "private" })
  await panel.open()
  await new Promise((resolve) => setTimeout(resolve, 15))
  expect(panel.state.opened).toBe(false)
  expect(panel.state.error).toBe("timeout")
  panel.dispose()
})

test("empty fields do not send a login request", async () => {
  const panel = createModelHubConsole(async () => {
    throw new Error("must not request")
  })
  await panel.open()
  expect(panel.state.error).toBe("invalid")
  expect(panel.state.busy).toBe(false)
  panel.dispose()
})
