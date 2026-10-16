export type ExtensionSettings = {
  skillsPaths: string[]
  mcp: { name: string; url: string; enabled: boolean }[]
}
export function validateExtensions(value: unknown): ExtensionSettings
export function loadExtensions(file?: string): ExtensionSettings
export function saveExtensions(file: string, value: unknown): ExtensionSettings

export function extensionState(file: string): ExtensionSettings & { revision: string }
export function saveExtensionState(file: string, value: unknown): ExtensionSettings & { revision: string }
