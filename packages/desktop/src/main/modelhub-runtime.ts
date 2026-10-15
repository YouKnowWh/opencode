import { app, BrowserWindow, net, safeStorage } from "electron"
import { join } from "node:path"
import { createModelHubAccount } from "./modelhub-account"
import { createModelHubVault } from "./modelhub-vault"
import { createModelHubLogin } from "./modelhub-login"
import { createModelHubManagement } from "./modelhub-management"

let runtime: ReturnType<typeof createRuntime> | undefined
export function getModelHubRuntime() {
  return (runtime ??= createRuntime())
}

function createRuntime() {
  const verifier = createModelHubLogin((url, options) => net.fetch(url, options))
  const account = createModelHubAccount({
    verify: async (value) => {
      const result = await verifier.set(0, value)
      verifier.clear(0)
      return result
    },
    vault: createModelHubVault(join(app.getPath("userData"), "modelhub-account.enc"), {
      available: () =>
        safeStorage.isEncryptionAvailable() &&
        (process.platform !== "linux" || safeStorage.getSelectedStorageBackend() !== "basic_text"),
      encrypt: (value) => safeStorage.encryptString(value),
      decrypt: (value) => safeStorage.decryptString(value),
    }),
    changed: (state) =>
      BrowserWindow.getAllWindows().forEach((win) => win.webContents.send("modelhub-account-state", state)),
  })
  const management = createModelHubManagement({
    authorization: account.authorization,
    rejected: account.rejected,
    fetch: (url, options) => net.fetch(url, options),
  })
  return { account, management }
}
