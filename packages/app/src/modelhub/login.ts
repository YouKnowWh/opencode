export type ModelHubLoginError =
  | "invalid"
  | "credentials"
  | "forbidden"
  | "network"
  | "timeout"
  | "unavailable"
  | "storage"
export type ModelHubLoginResult = { ok: true } | { ok: false; error: ModelHubLoginError }
