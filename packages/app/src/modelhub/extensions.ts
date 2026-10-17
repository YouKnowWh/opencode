import type { ExtensionSettings } from "../../../../modelhub/extensions.mjs"

export type ModelHubExtensions = ExtensionSettings & {
  revision: string
}
export type ModelHubExtensionsAPI = {
  get(): Promise<ModelHubExtensions>
  save(value: ModelHubExtensions): Promise<ModelHubExtensions>
}
