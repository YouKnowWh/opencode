export const MODEL_HUB_URL = "https://llm.alex045.xyz/hub/#/hub?section=roles"

export function modelHubRole(model?: { providerID: string; modelID: string }) {
  if (!model) return
  if (model.providerID === "modelhub-arona" && model.modelID === "arona") return "arona"
  if (model.providerID === "modelhub-prana" && model.modelID === "prana") return "prana"
}
