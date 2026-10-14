import { tool } from "@opencode-ai/plugin"
import { HubClient, checkKey } from "./hub-client.mjs"
import { RoleBindings, modelRole } from "./bindings.mjs"

function executionRole(ctx) {
  const role = modelRole(ctx.extra?.model)
  if (ctx.agent !== role) throw new Error("记忆工具的模型与执行角色不一致")
  return role
}

export default async function ModelHub() {
  const bindings = new RoleBindings(process.env.MODELHUB_BINDINGS_DIR)
  const clients = Object.fromEntries(
    ["arona", "prana"].map((role) => [role, new HubClient(role, process.env[`MODELHUB_${role.toUpperCase()}_KEY`])]),
  )
  const invoke = (op) => async (args, ctx) => {
    const role = executionRole(ctx)
    return clients[role].call(op, args, ctx.sessionID, ctx.abort)
  }
  return {
    "chat.message": async (input, output) => {
      const message = output.message
      const role = modelRole(message?.model)
      checkKey(clients[role].key)
      if (message.agent !== role || message.sessionID !== input.sessionID) throw new Error("请选择与会话相符的角色")
      bindings.select(input.sessionID, role)
    },
    "chat.headers": async (input, output) => {
      const role = modelRole(input.model)
      checkKey(clients[role].key)
      if (!["title", "summary", "compaction"].includes(input.agent) && input.agent !== role)
        throw new Error("模型与当前执行角色不一致")
      // Each request authenticates with its own selected role. Auxiliary calls
      // must not mutate the active role of a concurrently continuing conversation.
      if (!input.sessionID) throw new Error("缺少会话来源")
      Object.assign(output.headers, {
        "X-Session-ID": input.sessionID,
        "X-Request-Purpose": ["title", "summary", "compaction"].includes(input.agent) ? "auxiliary" : "chat",
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
