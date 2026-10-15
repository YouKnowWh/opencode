import { expect, test } from "bun:test"
import { mkdtemp, readFile, rm, stat, writeFile, readdir } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"
import { createModelHubVault } from "./modelhub-vault"

test("vault round trip stores encrypted bytes atomically with private mode; clear removes them", async () => {
  const folder = await mkdtemp(join(tmpdir(), "modelhub-vault-"))
  const key = randomBytes(32)
  const vault = createModelHubVault(join(folder, "account.enc"), {
    available: () => true,
    encrypt: (value) => {
      const iv = randomBytes(12),
        cipher = createCipheriv("aes-256-gcm", key, iv)
      const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
      return Buffer.concat([iv, cipher.getAuthTag(), data])
    },
    decrypt: (value) => {
      const decipher = createDecipheriv("aes-256-gcm", key, value.subarray(0, 12))
      decipher.setAuthTag(value.subarray(12, 28))
      return Buffer.concat([decipher.update(value.subarray(28)), decipher.final()]).toString("utf8")
    },
  })
  try {
    await vault.write({ username: "test-user", password: "secret-fixture" })
    expect(await vault.read()).toEqual({ username: "test-user", password: "secret-fixture" })
    expect((await readFile(join(folder, "account.enc"))).includes(Buffer.from("secret-fixture"))).toBe(false)
    expect((await stat(join(folder, "account.enc"))).mode & 0o777).toBe(0o600)
    expect(await readdir(folder)).toEqual(["account.enc"])
    await vault.clear()
    expect(await vault.read()).toBeUndefined()
    expect(await readdir(folder)).toEqual([])
  } finally {
    await rm(folder, { recursive: true, force: true })
  }
})

test("no encryption fallback; corrupt ciphertext cannot be restored", async () => {
  const folder = await mkdtemp(join(tmpdir(), "modelhub-vault-"))
  const path = join(folder, "account.enc")
  const unavailable = createModelHubVault(path, {
    available: () => false,
    encrypt: () => {
      throw new Error("must not encrypt")
    },
    decrypt: () => {
      throw new Error("must not decrypt")
    },
  })
  try {
    await expect(unavailable.write({ username: "test", password: "secret" })).rejects.toThrow(
      "Secure storage unavailable",
    )
    expect(await readdir(folder)).toEqual([])
    await writeFile(path, "not ciphertext")
    const broken = createModelHubVault(path, {
      available: () => true,
      encrypt: () => Buffer.from(""),
      decrypt: () => {
        throw new Error("corrupt")
      },
    })
    await expect(broken.read()).rejects.toThrow("corrupt")
  } finally {
    await rm(folder, { recursive: true, force: true })
  }
})
