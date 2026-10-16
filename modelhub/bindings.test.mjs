import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync, symlinkSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { RoleBindings, modelRole } from "./bindings.mjs"
import { desktopConfig } from "./config.mjs"
test("role selection survives restarts and permits handoff while rejecting invalid aliases", () => {
  const root = mkdtempSync(path.join(tmpdir(), "modelhub-bindings-"))
  try {
    const b = new RoleBindings(root)
    b.select("ses_one", "arona")
    new RoleBindings(root).select("ses_one", "prana")
    assert.equal(b.get("ses_one"), "prana")
    assert.equal(JSON.parse(readFileSync(path.join(root, "ses_one.json"))).role, "prana")
    assert.throws(() => b.select("../other", "arona"))
    assert.throws(() => modelRole({ providerID: "modelhub-arona", modelID: "prana" }))
    assert.throws(() => modelRole({ providerID: "modelhub-arona", modelID: "deepseek-v4-flash" }))
    symlinkSync(path.join(root, "ses_one.json"), path.join(root, "ses_two.json"))
    assert.throws(() => b.get("ses_two"))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
test("combined configuration uses separate credentials and keeps auxiliary models role-local", () => {
  const c = desktopConfig("/tmp/plugin.mjs")
  assert.equal(c.small_model, undefined)
  assert.equal(c.provider["modelhub-prana"].npm, "@ai-sdk/openai")
  assert.deepEqual(c.provider["modelhub-arona"].whitelist, ["arona"])
  assert.notEqual(c.provider["modelhub-arona"].options.apiKey, c.provider["modelhub-prana"].options.apiKey)
  assert.equal(c.agent.title, undefined)
  assert.equal(c.permission.memory_propose, "ask")
})
