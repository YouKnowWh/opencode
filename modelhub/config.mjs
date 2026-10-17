import { pathToFileURL } from "node:url"
export function desktopConfig(pluginPath) {
  const roles = ["arona", "prana"]
  return {
    $schema: "https://opencode.ai/config.json",
    share: "disabled",
    autoupdate: "notify",
    shell: "/bin/zsh",
    model: "modelhub-arona/arona",
    default_agent: "arona",
    enabled_providers: roles.map((r) => `modelhub-${r}`),
    provider: Object.fromEntries(
      roles.map((role) => [
        `modelhub-${role}`,
        {
          name: `Model Hub · ${role.toUpperCase()}`,
          npm: role === "arona" ? "@ai-sdk/openai-compatible" : "@ai-sdk/openai",
          options: {
            baseURL: "https://llm.alex045.xyz/v1",
            apiKey: `{env:MODELHUB_${role.toUpperCase()}_KEY}`,
            timeout: 120000,
          },
          whitelist: [role],
          models: { [role]: { name: role.toUpperCase(), tool_call: true, limit: { context: 32768, output: 4096 } } },
        },
      ]),
    ),
    agent: {
      build: { disable: true },
      plan: { disable: true },
      general: { disable: true },
      explore: { disable: true },
      ...Object.fromEntries(
        roles.map((role) => [
          role,
          {
            mode: "primary",
            model: `modelhub-${role}/${role}`,
            description: "服务端角色；真实模型和人设由 Model Hub 管理。",
            permission: { task: { "*": "deny", [`${role}-explore`]: "ask", [`${role}-worker`]: "ask" } },
            prompt:
              "角色身份和基础人设由 Model Hub 注入。优先使用当前会话已有上下文；仅在需要上下文之外的长期信息时调用 memory_search。检索摘要足够时直接回答，只有需要细节才调用 memory_read。memory_propose 仅提交待审核候选。不要创建开发服务器、watch 或后台进程。",
          },
        ]),
      ),
      ...Object.fromEntries(
        roles.flatMap((role) =>
          ["explore", "worker"].map((kind) => [
            `${role}-${kind}`,
            {
              mode: "subagent",
              model: `modelhub-${role}/${role}`,
              description:
                kind === "explore"
                  ? `Read-only project research for ${role.toUpperCase()}`
                  : `Scoped implementation or review for ${role.toUpperCase()}`,
              prompt:
                "Use the current project AGENTS.md. Keep the assigned scope. Do not start dev servers, watch tasks or background processes. Report evidence and tests to the parent. Long-term memory belongs only to your executing role.",
              permission: {
                task: "deny",
                ...(kind === "explore" ? { edit: "deny", shell: "deny", memory_propose: "deny" } : {}),
              },
            },
          ]),
        ),
      ),
    },
    command: {
      review: {
        description: "Review the current project changes without editing files",
        template:
          "Review the uncommitted changes in this project, or the target specified in $ARGUMENTS. Follow AGENTS.md. Read diffs and related code, identify concrete bugs with file/line evidence, and report validation gaps. Do not change files or start background processes.",
      },
    },
    // No global small_model: auxiliary agents must follow this session's provider.
    plugin: [pathToFileURL(pluginPath).href],
    permission: {
      "*": "ask",
      read: "allow",
      glob: "allow",
      grep: "allow",
      memory_search: "allow",
      memory_read: "allow",
      memory_propose: "ask",
      task: "deny",
      external_directory: "ask",
    },
    lsp: false,
    formatter: false,
    snapshot: false,
    compaction: { auto: true, prune: false },
    experimental: { openTelemetry: false },
  }
}
