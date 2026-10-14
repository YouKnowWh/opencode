export async function upstreamVersion(fetcher: (url: string, options?: RequestInit) => Promise<Response> = fetch) {
  const response = await fetcher("https://api.github.com/repos/anomalyco/opencode/releases/latest", {
    credentials: "omit",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error("Upstream version unavailable")
  const data: unknown = await response.json()
  if (
    !data ||
    typeof data !== "object" ||
    !("tag_name" in data) ||
    typeof data.tag_name !== "string" ||
    !/^v\d+\.\d+\.\d+(?:[-.][a-zA-Z0-9.-]+)?$/.test(data.tag_name)
  )
    throw new Error("Invalid upstream version")
  return data.tag_name
}
