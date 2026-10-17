export const HUB = "https://llm.alex045.xyz/v1"
export const ROLES = Object.freeze(["arona", "prana"])
const AUX = new Set(["title", "summary", "compaction"])
export function checkRole(role) {
  if (!ROLES.includes(role)) throw new Error("未知角色配置")
  return role
}
export function checkKey(key) {
  if (typeof key !== "string" || !/^sk-[A-Za-z0-9_-]{8,}$/.test(key)) throw new Error("尚未配置有效的角色专属 API Key")
  return key
}
export function requestHeaders(role, input) {
  checkRole(role)
  if (input.model?.providerID !== `modelhub-${role}` || input.model?.id !== role)
    throw new Error("当前配置只能使用所属角色别名；不能切换其他角色或真实模型")
  if (!input.sessionID || input.sessionID.length > 512) throw new Error("缺少有效会话 ID")
  return { "X-Session-ID": input.sessionID, "X-Request-Purpose": AUX.has(input.agent) ? "auxiliary" : "chat" }
}
export class HubClient {
  constructor(role, key, fetcher = fetch) {
    this.role = checkRole(role)
    this.key = key
    this.fetcher = fetcher
  }
  async call(operation, body, sessionID, signal, workspaceID) {
    if (!["search", "read", "candidates"].includes(operation)) throw new Error("不支持的记忆操作")
    checkKey(this.key)
    if (!sessionID) throw new Error("缺少会话来源")
    const controller = AbortSignal.any([AbortSignal.timeout(15000), ...(signal ? [signal] : [])])
    let response
    try {
      response = await this.fetcher(`${HUB}/memory/${operation}`, {
        method: "POST",
        redirect: "error",
        signal: controller,
        headers: {
          Authorization: `Bearer ${this.key}`,
          "Content-Type": "application/json",
          "X-Session-ID": sessionID,
          "X-Request-Purpose": "auxiliary",
          ...(workspaceID ? { "X-Workspace-ID": workspaceID } : {}),
        },
        // Client input can never replace role, identity, purpose or authorization.
        body: JSON.stringify(
          operation === "search"
            ? { query: body.query, limit: Math.min(body.limit ?? 6, 10) }
            : operation === "read"
              ? { refs: body.refs, offset: body.offset ?? 0, limit: Math.min(body.limit ?? 2048, 4096) }
              : { content: body.content, evidence: body.evidence },
        ),
      })
    } catch {
      throw new Error(controller.aborted ? "记忆请求取消或超时" : "无法连接记忆服务")
    }
    if (!response.ok) throw new Error(`记忆服务返回 HTTP ${response.status}（响应正文未显示）`)
    const reader = response.body.getReader()
    const chunks = []
    let size = 0
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.length
        if (size > 32768) {
          await reader.cancel()
          throw new Error("记忆结果超出读取预算，请缩小范围")
        }
        chunks.push(value)
      }
      const bytes = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) {
        bytes.set(chunk, offset)
        offset += chunk.length
      }
      return JSON.stringify(JSON.parse(new TextDecoder().decode(bytes)))
    } catch (error) {
      if (error.message === "记忆结果超出读取预算，请缩小范围") throw error
      throw new Error("记忆服务响应无效或读取中断")
    }
  }
}
