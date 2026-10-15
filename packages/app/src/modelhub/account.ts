import type { ModelHubLoginError, ModelHubLoginResult } from "./login"

export type ModelHubAccountState = {
  signedIn: boolean
  username?: string
  remembered: boolean
  secureStorage: boolean
  error?: ModelHubLoginError
}
export type ModelHubSnapshot = {
  roles: { id: string; name: string; alias: string; status: string; model: string; allowedModels: string[] }[]
  models: { name: string; capabilities: string[] }[]
}
export type ModelHubAccountAPI = {
  state(): Promise<ModelHubAccountState>
  subscribe(callback: (state: ModelHubAccountState) => void): () => void
  signIn(value: { username: string; password: string; remember: boolean }): Promise<ModelHubLoginResult>
  signOut(): Promise<void>
  prepare(): Promise<ModelHubLoginResult>
  snapshot(): Promise<ModelHubSnapshot>
  selectModel(value: { roleId: string; model: string }): Promise<void>
}
