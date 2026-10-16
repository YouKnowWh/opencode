import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import { randomUUID } from "node:crypto"
import type { ModelHubVault } from "./modelhub-account"

/** safeStorage ciphertext only. Never fall back to plaintext or Linux basic_text. */
export function createModelHubVault(
  path: string,
  encryption: {
    available(): boolean
    encrypt(value: string): Buffer
    decrypt(value: Buffer): string
  },
): ModelHubVault {
  return {
    available: encryption.available,
    async read() {
      if (!encryption.available()) return
      const bytes = await readFile(path).catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return undefined
        throw error
      })
      if (!bytes) return
      const value = JSON.parse(encryption.decrypt(bytes))
      if (
        value.version !== 1 ||
        typeof value.username !== "string" ||
        typeof value.password !== "string" ||
        !value.username ||
        !value.password ||
        value.username.length > 256 ||
        value.password.length > 4096 ||
        /[\r\n:]/.test(value.username)
      )
        throw new Error("Invalid saved Model Hub account")
      return { username: value.username, password: value.password }
    },
    async write(value) {
      if (!encryption.available()) throw new Error("Secure storage unavailable")
      const ciphertext = encryption.encrypt(JSON.stringify({ version: 1, ...value }))
      await mkdir(dirname(path), { recursive: true, mode: 0o700 })
      const temporary = `${path}.${randomUUID()}.tmp`
      try {
        await writeFile(temporary, ciphertext, { mode: 0o600, flag: "wx" })
        await rename(temporary, path)
        await chmod(path, 0o600)
      } finally {
        await rm(temporary, { force: true })
      }
    },
    async clear() {
      await rm(path, { force: true })
    },
  }
}
