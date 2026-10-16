export type ModelHubExtensions = {
  revision: string
  skillsPaths: string[]
  mcp: { name: string; url: string; enabled: boolean }[]
}
export type ModelHubExtensionsAPI = {
  get(): Promise<ModelHubExtensions>
  save(value: ModelHubExtensions): Promise<ModelHubExtensions>
}
