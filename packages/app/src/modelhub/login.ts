export type ModelHubLoginError = "invalid" | "credentials" | "forbidden" | "network" | "timeout" | "unavailable"
export type ModelHubLoginResult = { ok: true } | { ok: false; error: ModelHubLoginError }
