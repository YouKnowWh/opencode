import { expect, test } from "bun:test"
import { modelHubRole } from "./roles"

test("recognizes only dedicated role aliases", () => {
  expect(modelHubRole({ providerID: "modelhub-arona", modelID: "arona" })).toBe("arona")
  expect(modelHubRole({ providerID: "modelhub-prana", modelID: "prana" })).toBe("prana")
  expect(modelHubRole({ providerID: "modelhub-arona", modelID: "prana" })).toBeUndefined()
  expect(modelHubRole({ providerID: "modelhub-arona", modelID: "deepseek-v4-flash" })).toBeUndefined()
  expect(modelHubRole({ providerID: "openai", modelID: "prana" })).toBeUndefined()
})
