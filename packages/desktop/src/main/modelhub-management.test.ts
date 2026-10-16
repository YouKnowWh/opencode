import { expect, test } from "bun:test"
import { createModelHubManagement, modelHubSnapshot } from "./modelhub-management"

const raw = {
  api_accounts: [{ name: "vendor", secret: "upstream-must-not-leak" }],
  roles: [
    {
      id: "role-a",
      name: "ARONA",
      alias: "arona",
      status: "published",
      policy_id: "policy-a",
      prompt: "private persona",
      allowed_models: ["flash", "large"],
      functions: { llm: "flash", embedding: "embed", ranker: null },
    },
  ],
  policies: [
    { id: "policy-a", targets: [{ model: "flash" }, { model: "large" }], timeout: 77, concurrency: 2, budget: 3.4 },
  ],
  models: [
    { name: "arona", capabilities: ["llm"] },
    { name: "flash", capabilities: ["llm"] },
    { name: "large", capabilities: ["llm"] },
    { name: "embed", capabilities: ["embedding"] },
    { name: "disallowed", capabilities: ["llm"] },
  ],
}

test("snapshot projects only safe native control fields and excludes virtual roles from real models", () => {
  const snapshot = modelHubSnapshot(raw)
  expect(snapshot.roles[0].model).toBe("flash")
  expect(snapshot.models.map((m) => m.name)).toEqual(["flash", "large", "embed", "disallowed"])
  expect(JSON.stringify(snapshot)).not.toContain("upstream-must-not-leak")
  expect(JSON.stringify(snapshot)).not.toContain("private persona")
  expect(modelHubSnapshot({ roles: [null], models: [], policies: [] })).toHaveProperty("roles")
})

test("native selection calls the fixed role settings API and preserves timeout, concurrency, budget and embedding", async () => {
  const requests: { url: string; options: RequestInit }[] = []
  const management = createModelHubManagement({
    authorization: async () => "Basic fixture-authorization",
    fetch: async (url, options) => {
      requests.push({ url, options })
      return Response.json(options.method === "GET" ? raw : { ok: true })
    },
  })
  await management.selectModel({ roleId: "role-a", model: "large" })
  expect(requests).toHaveLength(2)
  expect(requests[1].url).toBe("https://llm.alex045.xyz/admin/hub/roles/role-a/settings")
  expect(requests[1].options.redirect).toBe("error")
  expect(requests[1].options.credentials).toBe("omit")
  expect(JSON.parse(String(requests[1].options.body))).toEqual({
    model: "large",
    allowed_models: ["flash", "large"],
    embedding: "embed",
    ranker: null,
    fallbacks: [],
    timeout: 77,
    concurrency: 2,
    budget: 3.4,
  })
})

test("disallowed models, non-LLMs and unknown roles never issue a mutation", async () => {
  let writes = 0
  const management = createModelHubManagement({
    authorization: async () => "Basic fixture",
    fetch: async (_url, options) => {
      if (options.method !== "GET") writes++
      return Response.json(raw)
    },
  })
  for (const input of [
    { roleId: "role-a", model: "disallowed" },
    { roleId: "role-a", model: "embed" },
    { roleId: "role-other", model: "flash" },
  ])
    await expect(management.selectModel(input)).rejects.toThrow("forbidden")
  expect(writes).toBe(0)
})

test("server errors and unauthorized bodies never expose raw upstream details", async () => {
  const rejected: string[] = []
  const management = createModelHubManagement({
    authorization: async () => "Basic fixture",
    rejected: async (_auth, error) => {
      rejected.push(error)
    },
    fetch: async () => new Response("upstream-secret-text", { status: 401 }),
  })
  await expect(management.snapshot()).rejects.toThrow("credentials")
  expect(rejected).toEqual(["credentials"])
})

test("oversized management responses stop reading at the bound", async () => {
  let cancelled = false
  const management = createModelHubManagement({
    authorization: async () => "Basic fixture",
    fetch: async () =>
      new Response(
        new ReadableStream({
          pull(controller) {
            controller.enqueue(new Uint8Array(1_100_000))
          },
          cancel() {
            cancelled = true
          },
        }),
      ),
  })
  await expect(management.snapshot()).rejects.toThrow("unavailable")
  expect(cancelled).toBe(true)
})

test("invalid JSON errors are replaced before crossing IPC", async () => {
  const management = createModelHubManagement({
    authorization: async () => "Basic fixture",
    fetch: async () => new Response("private-invalid-response"),
  })
  const error = await management.snapshot().catch((value: Error) => value)
  expect(error).toBeInstanceOf(Error)
  expect((error as Error).message).toBe("unavailable")
})
