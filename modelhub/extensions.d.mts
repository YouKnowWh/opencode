export type ExtensionSettings = {
  skillsPaths: string[]
  mcp: (
    | { name: string; type?: "remote"; url: string; headers?: Record<string, string>; enabled: boolean }
    | { name: string; type: "local"; command: string[]; environment?: Record<string, string>; enabled: boolean }
  )[]
}
export function validateExtensions(value: unknown): ExtensionSettings
export function loadExtensions(file?: string): ExtensionSettings
export function saveExtensions(file: string, value: unknown): ExtensionSettings

export function extensionState(file: string): ExtensionSettings & { revision: string }
export function saveExtensionState(file: string, value: unknown): ExtensionSettings & { revision: string }
