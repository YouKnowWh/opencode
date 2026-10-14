import { expect, test } from "bun:test"
import { upstreamVersion } from "./upstream"

test("upstream check sends no console credential and only returns a validated tag", async () => {
  const fetcher = async (url: string, options?: RequestInit) => {
    expect(url).toBe("https://api.github.com/repos/anomalyco/opencode/releases/latest")
    expect(options?.credentials).toBe("omit")
    expect(options?.redirect).toBe("error")
    expect(options?.headers).toBeUndefined()
    return new Response(JSON.stringify({ tag_name: "v1.20.0" }))
  }
  expect(await upstreamVersion(fetcher)).toBe("v1.20.0")
  await expect(upstreamVersion(async () => new Response("", { status: 500 }))).rejects.toThrow()
  await expect(upstreamVersion(async () => new Response(JSON.stringify({ tag_name: "<script>" })))).rejects.toThrow()
})
