import { existsSync, realpathSync, statSync } from "node:fs"
import path from "node:path"
import { loadExtensions } from "./extensions.mjs"
import { tool } from "@opencode-ai/plugin"
import { HubClient, checkKey } from "./hub-client.mjs"
import { RoleBindings, modelRole } from "./bindings.mjs"

function executionRole(ctx) {
  const role = modelRole(ctx.extra?.model)
  if (![role, `${role}-explore`, `${role}-worker`].includes(ctx.agent))
    throw new Error("记忆工具的模型与执行角色不一致")
  return role
}

export default async function ModelHub(input = {}) {
  const instructions = []
  if (input.directory && input.worktree) {
    const root = realpathSync(input.worktree === path.parse(input.worktree).root ? input.directory : input.worktree)
    const directory = realpathSync(input.directory)
    const relative = path.relative(root, directory)
    if (relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))) {
      for (let current = directory; ; current = path.dirname(current)) {
        const file = path.join(current, "AGENTS.md")
        if (existsSync(file) && statSync(file).isFile()) {
          const resolved = realpathSync(file)
          const within = path.relative(root, resolved)
          if (within !== ".." && !within.startsWith(`..${path.sep}`) && !path.isAbsolute(within))
            instructions.unshift(resolved)
        }
        if (current === root) break
      }
    }
  }
  const bindings = new RoleBindings(process.env.MODELHUB_BINDINGS_DIR)
  const clients = Object.fromEntries(
    ["arona", "prana"].map((role) => [role, new HubClient(role, process.env[`MODELHUB_${role.toUpperCase()}_KEY`])]),
  )
  const invoke = (op) => async (args, ctx) => {
    const role = executionRole(ctx)
    return clients[role].call(op, args, ctx.sessionID, ctx.abort)
  }
  return {
    config: async (config) => {
      config.instructions = [...new Set([...(config.instructions ?? []), ...instructions])]
      const extensions = loadExtensions(process.env.MODELHUB_EXTENSIONS_FILE)
      config.skills = {
        ...config.skills,
        paths: [...new Set([...(config.skills?.paths ?? []), ...extensions.skillsPaths])],
      }
      config.mcp = {
        ...config.mcp,
        ...Object.fromEntries(
          extensions.mcp.map((entry) => [entry.name, { type: "remote", url: entry.url, enabled: entry.enabled }]),
        ),
      }
    },
    "chat.message": async (input, output) => {
      const message = output.message
      const role = modelRole(message?.model)
      checkKey(clients[role].key)
      if (![role, `${role}-explore`, `${role}-worker`].includes(message.agent) || message.sessionID !== input.sessionID)
        throw new Error("请选择与会话相符的角色")
      bindings.select(input.sessionID, role)
    },
    "chat.headers": async (input, output) => {
      const role = modelRole(input.model)
      checkKey(clients[role].key)
      if (
        !["title", "summary", "compaction"].includes(input.agent) &&
        ![role, `${role}-explore`, `${role}-worker`].includes(input.agent)
      )
        throw new Error("模型与当前执行角色不一致")
      // Each request authenticates with its own selected role. Auxiliary calls
      // must not mutate the active role of a concurrently continuing conversation.
      if (!input.sessionID) throw new Error("缺少会话来源")
      Object.assign(output.headers, {
        "X-Session-ID": input.sessionID,
        "X-Request-Purpose": ["title", "summary", "compaction", `${role}-explore`, `${role}-worker`].includes(
          input.agent,
        )
          ? "auxiliary"
          : "chat",
      })
    },
    "shell.env": async (_, output) => {
      for (const name of ["MODELHUB_KEY", "MODELHUB_ARONA_KEY", "MODELHUB_PRANA_KEY"]) output.env[name] = ""
    },
    tool: {
      memory_search: tool({
        description: "检索当前角色概要，返回原文索引。",
        args: {
          query: tool.schema.string().min(1).max(500),
          limit: tool.schema.number().int().min(1).max(10).optional(),
        },
        execute: invoke("search"),
      }),
      memory_read: tool({
        description: "分页读取当前角色的原文证据；不要猜测索引。",
        args: {
          refs: tool.schema.array(tool.schema.string()).min(1).max(6),
          offset: tool.schema.number().int().min(0).optional(),
          limit: tool.schema.number().int().min(1).max(4096).optional(),
        },
        execute: invoke("read"),
      }),
      memory_propose: tool({
        description: "提交当前角色记忆候选，需授权和服务器审核。",
        args: { content: tool.schema.string().min(1).max(16000), evidence: tool.schema.string().max(4000).optional() },
        execute: async (args, ctx) => {
          const role = executionRole(ctx)
          await ctx.ask({ permission: "memory_propose", patterns: [role], always: [], metadata: { role } })
          return invoke("candidates")(args, ctx)
        },
      }),
    },
  }
}
