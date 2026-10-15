import type { ModelHubSnapshot } from "../../../app/src/modelhub/account"
import { modelHubHttpError } from "./modelhub-login"

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}
function rows(value: unknown) {
  return Array.isArray(value) ? value.map(record) : []
}
function text(value: unknown) {
  return typeof value === "string" ? value : ""
}
function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === "string") : []
}

/** An explicit projection: upstream account secrets and arbitrary state never enter the renderer. */
export function modelHubSnapshot(value: unknown): ModelHubSnapshot {
  const data = record(value)
  const roles = rows(data.roles)
  const aliases = new Set(roles.map((x) => text(x.alias)))
  return {
    roles: roles.map((role) => {
      const policy = rows(data.policies).find((p) => p.id === role.policy_id)
      const targets = rows(policy?.targets)
        .map((t) => text(t.model))
        .filter(Boolean)
      return {
        id: text(role.id),
        name: text(role.name),
        alias: text(role.alias),
        status: text(role.status) || "published",
        model: text(record(role.functions).llm) || targets[0] || "",
        allowedModels: Array.isArray(role.allowed_models) ? strings(role.allowed_models) : targets,
      }
    }),
    models: rows(data.models)
      .filter((m) => !aliases.has(text(m.name)))
      .map((m) => ({ name: text(m.name), capabilities: strings(m.capabilities) })),
  }
}

export function createModelHubManagement(deps: {
  authorization(): Promise<string>
  fetch(url: string, options: RequestInit): Promise<Response>
  rejected?(authorization: string, error: "credentials" | "forbidden"): Promise<void>
}) {
  const request = async (path: string, method = "GET", body?: unknown) => {
    const authorization = await deps.authorization()
    const response = await deps.fetch(`https://llm.alex045.xyz/admin/hub/${path}`, {
      method,
      redirect: "error",
      credentials: "omit",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
      headers: { Authorization: authorization, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const error = modelHubHttpError(response.status)
    if (error) {
      void response.body?.cancel().catch(() => {})
      if (error === "credentials" || error === "forbidden") await deps.rejected?.(authorization, error)
      throw new Error(error)
    }
    // The state includes administrator data; bound it and return only selected fields.
    const reader = response.body?.getReader()
    if (!reader) throw new Error("unavailable")
    const chunks: Uint8Array[] = []
    let size = 0
    try {
      while (true) {
        const chunk = await reader.read()
        if (chunk.done) break
        size += chunk.value.byteLength
        if (size > 2_000_000) throw new Error("unavailable")
        chunks.push(chunk.value)
      }
      return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown
    } catch {
      throw new Error("unavailable")
    } finally {
      await reader.cancel().catch(() => {})
    }
  }
  return {
    async snapshot() {
      return modelHubSnapshot(await request("state"))
    },
    async selectModel(input: { roleId: string; model: string }) {
      if (!input || typeof input.roleId !== "string" || typeof input.model !== "string") throw new Error("invalid")
      const raw = record(await request("state"))
      const snapshot = modelHubSnapshot(raw)
      const role = snapshot.roles.find((r) => r.id === input.roleId && r.status !== "draft")
      const model = snapshot.models.find((m) => m.name === input.model && m.capabilities.includes("llm"))
      if (!role || !model || !role.allowedModels.includes(model.name)) throw new Error("forbidden")
      const source = rows(raw.roles).find((r) => r.id === role.id)!
      const policy = rows(raw.policies).find((p) => p.id === source.policy_id)
      if (!policy) throw new Error("unavailable")
      await request(`roles/${encodeURIComponent(role.id)}/settings`, "PUT", {
        model: model.name,
        allowed_models: role.allowedModels,
        embedding: record(source.functions).embedding ?? null,
        ranker: record(source.functions).ranker ?? null,
        fallbacks: rows(policy.targets)
          .slice(1)
          .map((t) => text(t.model))
          .filter((m) => m && m !== model.name),
        timeout: policy.timeout,
        concurrency: policy.concurrency,
        budget: policy.budget ?? null,
      })
    },
  }
}
