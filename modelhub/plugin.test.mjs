import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import ModelHub from "./plugin.mjs"
import { RoleBindings } from "./bindings.mjs"

test("same-session handoff keeps headers stable and each memory tool uses its executing role", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "modelhub-plugin-"))
  const saved = { ...process.env },
    original = globalThis.fetch
  try {
    Object.assign(process.env, {
      MODELHUB_BINDINGS_DIR: root,
      MODELHUB_ARONA_KEY: "sk-test-arona",
      MODELHUB_PRANA_KEY: "sk-test-prana",
    })
    const seen = []
    globalThis.fetch = async (url, options) => {
      seen.push({ url, authorization: options.headers.Authorization, body: JSON.parse(options.body) })
      return new Response(JSON.stringify({ refs: [] }))
    }
    const hooks = await ModelHub()
    for (const role of ["arona", "prana", "arona"]) {
      await hooks["chat.message"](
        { sessionID: "ses_handoff" },
        {
          message: { sessionID: "ses_handoff", agent: role, model: { providerID: `modelhub-${role}`, modelID: role } },
          parts: [],
        },
      )
      const output = { headers: {} }
      await hooks["chat.headers"](
        { sessionID: "ses_handoff", agent: role, model: { providerID: `modelhub-${role}`, id: role } },
        output,
      )
      assert.equal(output.headers["X-Session-ID"], "ses_handoff")
      assert.equal(output.headers["X-Request-Purpose"], "chat")
    }
    const output = { headers: {} }
    await hooks["chat.headers"](
      { sessionID: "ses_handoff", agent: "title", model: { providerID: "modelhub-prana", id: "prana" } },
      output,
    )
    assert.equal(output.headers["X-Request-Purpose"], "auxiliary")
    assert.equal(new RoleBindings(root).get("ses_handoff"), "arona")
    for (const role of ["prana", "arona"])
      await hooks.tool.memory_search.execute(
        { query: "test", role: "forged" },
        { agent: role, sessionID: "ses_handoff", extra: { model: { providerID: `modelhub-${role}`, id: role } } },
      )
    assert.deepEqual(
      seen.map((x) => x.authorization),
      ["Bearer sk-test-prana", "Bearer sk-test-arona"],
    )
    assert.ok(seen.every((x) => !("role" in x.body)))
    await assert.rejects(
      hooks.tool.memory_search.execute({ query: "test" }, { agent: "build", sessionID: "ses_handoff" }),
    )
    await assert.rejects(
      hooks["chat.message"](
        { sessionID: "ses_handoff", model: { providerID: "modelhub-prana", modelID: "prana" } },
        {
          message: {
            sessionID: "ses_handoff",
            agent: "arona",
            model: { providerID: "modelhub-prana", modelID: "prana" },
          },
        },
      ),
    )
    await assert.rejects(
      hooks["chat.headers"](
        { sessionID: "ses_handoff", agent: "arona", model: { providerID: "modelhub-prana", id: "prana" } },
        { headers: {} },
      ),
    )
    await assert.rejects(
      hooks.tool.memory_search.execute(
        { query: "test" },
        {
          agent: "arona",
          sessionID: "ses_handoff",
          extra: { model: { providerID: "modelhub-prana", id: "prana" } },
        },
      ),
    )
    assert.equal(seen.length, 2)
  } finally {
    globalThis.fetch = original
    for (const name of ["MODELHUB_BINDINGS_DIR", "MODELHUB_ARONA_KEY", "MODELHUB_PRANA_KEY"]) {
      if (saved[name] === undefined) delete process.env[name]
      else process.env[name] = saved[name]
    }
    rmSync(root, { recursive: true, force: true })
  }
})
