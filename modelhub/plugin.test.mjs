import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync, mkdirSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import ModelHub from "./plugin.mjs"
import { RoleBindings } from "./bindings.mjs"
import { workspaceIdentity } from "./workspace.mjs"

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
      seen.push({
        url,
        authorization: options.headers.Authorization,
        workspace: options.headers["X-Workspace-ID"],
        body: JSON.parse(options.body),
      })
      return new Response(JSON.stringify({ refs: [] }))
    }
    const hooks = await ModelHub({ directory: root, worktree: root })
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
      assert.equal(output.headers["X-Workspace-ID"], workspaceIdentity(root, root))
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
        { query: "test", role: "forged", workspace_id: "forged" },
        { agent: role, sessionID: "ses_handoff", extra: { model: { providerID: `modelhub-${role}`, id: role } } },
      )
    assert.deepEqual(
      seen.map((x) => x.authorization),
      ["Bearer sk-test-prana", "Bearer sk-test-arona"],
    )
    assert.ok(seen.every((x) => !("role" in x.body)))
    assert.ok(seen.every((x) => x.workspace === workspaceIdentity(root, root) && !("workspace_id" in x.body)))
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
    const helper = { headers: {} }
    await hooks["chat.headers"](
      { sessionID: "ses_child", agent: "arona-explore", model: { providerID: "modelhub-arona", id: "arona" } },
      helper,
    )
    assert.equal(helper.headers["X-Request-Purpose"], "auxiliary")
    await hooks.tool.memory_search.execute(
      { query: "test" },
      {
        agent: "arona-worker",
        sessionID: "ses_child",
        extra: { model: { providerID: "modelhub-arona", id: "arona" } },
      },
    )
    assert.equal(seen.at(-1).authorization, "Bearer sk-test-arona")
    await assert.rejects(
      hooks["chat.headers"](
        { sessionID: "ses_child", agent: "prana-worker", model: { providerID: "modelhub-arona", id: "arona" } },
        { headers: {} },
      ),
    )
    assert.equal(seen.length, 3)
  } finally {
    globalThis.fetch = original
    for (const name of ["MODELHUB_BINDINGS_DIR", "MODELHUB_ARONA_KEY", "MODELHUB_PRANA_KEY"]) {
      if (saved[name] === undefined) delete process.env[name]
      else process.env[name] = saved[name]
    }
    rmSync(root, { recursive: true, force: true })
  }
})

test("workspace IDs follow the actual project root, including symlinks and non-Git folders", () => {
  const root = mkdtempSync(path.join(tmpdir(), "modelhub-workspace-"))
  try {
    const project = path.join(root, "project")
    mkdirSync(path.join(project, "nested"), { recursive: true })
    const other = path.join(root, "other")
    mkdirSync(other)
    symlinkSync(project, path.join(root, "link"))
    const identity = workspaceIdentity(project, project)
    assert.match(identity, /^ws_[0-9a-f]{64}$/)
    assert.equal(workspaceIdentity(path.join(project, "nested"), project), identity)
    assert.equal(workspaceIdentity(path.join(root, "link"), project), identity)
    assert.equal(workspaceIdentity(project, path.parse(project).root), identity)
    assert.notEqual(workspaceIdentity(other, project), identity)
    assert.equal(workspaceIdentity(), undefined)
    assert.ok(!identity.includes(project))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
