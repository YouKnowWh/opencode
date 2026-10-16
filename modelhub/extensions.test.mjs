import { test } from "node:test"
import assert from "node:assert/strict"
import {
  chmodSync,
  realpathSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import {
  extensionState,
  saveExtensionState,
  loadExtensions,
  saveExtensions,
  validateExtensions,
} from "./extensions.mjs"
import ModelHub from "./plugin.mjs"
import { desktopConfig } from "./config.mjs"

test("extension settings survive reload and reject routing, credentials and unsafe files", () => {
  const root = mkdtempSync(path.join(tmpdir(), "modelhub-extensions-"))
  const file = path.join(root, "extensions.json")
  try {
    const value = {
      skillsPaths: ["/tmp/skills", "/tmp/skills"],
      mcp: [{ name: "docs", url: "https://example.com/mcp", enabled: true }],
    }
    assert.deepEqual(loadExtensions(file), { skillsPaths: [], mcp: [] })
    const saved = saveExtensions(file, value)
    assert.deepEqual(saved.skillsPaths, ["/tmp/skills"])
    assert.deepEqual(loadExtensions(file), saved)
    const old = extensionState(file)
    const changed = saveExtensionState(file, { ...old, skillsPaths: ["/tmp/second-window"] })
    assert.throws(() => saveExtensionState(file, { ...old, mcp: [] }))
    assert.deepEqual(extensionState(file), changed)
    saveExtensions(file, value)
    assert.throws(() => saveExtensions(file, { ...value, provider: { bad: {} } }))
    for (const url of [
      "http://example.com",
      "https://user:secret@example.com",
      "https://example.com?token=secret",
      "file:///tmp/code",
    ])
      assert.throws(() => validateExtensions({ ...value, mcp: [{ name: "bad", url, enabled: true }] }))
    assert.throws(() => validateExtensions({ ...value, mcp: [...value.mcp, ...value.mcp] }))
    assert.throws(() => validateExtensions({ ...value, skillsPaths: ["relative/path"] }))
    assert.throws(() =>
      saveExtensions(file, { skillsPaths: Array.from({ length: 32 }, (_, i) => `/${i}${"x".repeat(4000)}`), mcp: [] }),
    )
    assert.deepEqual(loadExtensions(file), saved)
    chmodSync(file, 0o644)
    assert.throws(() => loadExtensions(file))
    chmodSync(file, 0o600)
    writeFileSync(file, "broken")
    assert.throws(() => loadExtensions(file))
    assert.throws(() => loadExtensions(path.join(root, "absent", "file")))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("plugin loads only bounded project AGENTS and approved extension fields", async () => {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), "modelhub-project-")))
  const previousBindings = process.env.MODELHUB_BINDINGS_DIR
  process.env.MODELHUB_BINDINGS_DIR = root
  const previous = process.env.MODELHUB_EXTENSIONS_FILE
  try {
    mkdirSync(path.join(root, "project/nested"), { recursive: true })
    mkdirSync(path.join(root, "other"))
    writeFileSync(path.join(root, "AGENTS.md"), "Outside worktree")
    writeFileSync(path.join(root, "project/AGENTS.md"), "Project rules")
    writeFileSync(path.join(root, "project/nested/AGENTS.md"), "Nested rules")
    writeFileSync(path.join(root, "project/opencode.json"), '{"provider":{"bad":{}}}')
    process.env.MODELHUB_EXTENSIONS_FILE = path.join(root, "extensions.json")
    saveExtensions(process.env.MODELHUB_EXTENSIONS_FILE, {
      skillsPaths: ["/tmp/my-skills"],
      mcp: [{ name: "docs", url: "https://example.com/mcp", enabled: true }],
    })
    const hooks = await ModelHub({ directory: path.join(root, "project/nested"), worktree: path.join(root, "project") })
    const config = desktopConfig("/tmp/plugin.mjs")
    const routing = JSON.stringify({ provider: config.provider, agent: config.agent, permission: config.permission })
    await hooks.config(config)
    await hooks.config(config)
    assert.deepEqual(config.instructions, [
      path.join(root, "project/AGENTS.md"),
      path.join(root, "project/nested/AGENTS.md"),
    ])
    assert.deepEqual(config.skills.paths, ["/tmp/my-skills"])
    assert.equal(config.mcp.docs.url, "https://example.com/mcp")
    assert.equal(
      JSON.stringify({ provider: config.provider, agent: config.agent, permission: config.permission }),
      routing,
    )
    const outside = await ModelHub({ directory: path.join(root, "other"), worktree: path.join(root, "project") })
    const empty = {}
    await outside.config(empty)
    assert.deepEqual(empty.instructions, [])
    const nonGit = await ModelHub({ directory: path.join(root, "project/nested"), worktree: path.parse(root).root })
    const local = {}
    await nonGit.config(local)
    assert.deepEqual(local.instructions, [path.join(root, "project/nested/AGENTS.md")])
    rmSync(path.join(root, "project/nested/AGENTS.md"))
    symlinkSync(path.join(root, "AGENTS.md"), path.join(root, "project/nested/AGENTS.md"))
    const linked = await ModelHub({
      directory: path.join(root, "project/nested"),
      worktree: path.join(root, "project"),
    })
    const safe = {}
    await linked.config(safe)
    assert.deepEqual(safe.instructions, [path.join(root, "project/AGENTS.md")])
  } finally {
    if (previousBindings === undefined) delete process.env.MODELHUB_BINDINGS_DIR
    else process.env.MODELHUB_BINDINGS_DIR = previousBindings
    if (previous === undefined) delete process.env.MODELHUB_EXTENSIONS_FILE
    else process.env.MODELHUB_EXTENSIONS_FILE = previous
    rmSync(root, { recursive: true, force: true })
  }
})

test("foreground helpers are role-bound and the review command retains the selected role", () => {
  const config = desktopConfig("/tmp/plugin.mjs")
  for (const role of ["arona", "prana"]) {
    assert.equal(config.agent[role].permission.task[`${role}-worker`], "ask")
    assert.equal(config.agent[role].permission.task["*"], "deny")
    for (const kind of ["worker", "explore"]) {
      assert.equal(config.agent[`${role}-${kind}`].model, `modelhub-${role}/${role}`)
      assert.equal(config.agent[`${role}-${kind}`].permission.task, "deny")
    }
    assert.equal(config.agent[`${role}-explore`].permission.edit, "deny")
    assert.equal(config.agent[`${role}-explore`].permission.shell, "deny")
  }
  assert.equal(config.command.review.agent, undefined)
  assert.equal(config.command.review.subtask, undefined)
})
