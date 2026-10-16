import { existsSync, lstatSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import path from "node:path"
import { createHash, randomUUID } from "node:crypto"

export function validateExtensions(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !["skillsPaths", "mcp"].includes(key))
  )
    throw new Error("Invalid extension settings")
  if (
    !Array.isArray(value.skillsPaths) ||
    value.skillsPaths.length > 32 ||
    !value.skillsPaths.every(
      (entry) => typeof entry === "string" && entry.length < 4096 && path.isAbsolute(entry) && !entry.includes("\0"),
    )
  )
    throw new Error("Invalid Skills paths")
  if (!Array.isArray(value.mcp) || value.mcp.length > 32) throw new Error("Invalid MCP settings")
  const names = new Set()
  const mcp = value.mcp.map((entry) => {
    if (
      !entry ||
      typeof entry !== "object" ||
      Object.keys(entry).some((key) => !["name", "url", "enabled"].includes(key)) ||
      !/^[a-zA-Z0-9_-]{1,64}$/.test(entry.name) ||
      names.has(entry.name) ||
      typeof entry.url !== "string" ||
      entry.url.length > 4096 ||
      typeof entry.enabled !== "boolean"
    )
      throw new Error("Invalid MCP entry")
    const url = new URL(entry.url)
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash)
      throw new Error("MCP requires an HTTPS endpoint without embedded credentials")
    names.add(entry.name)
    return { name: entry.name, url: url.href, enabled: entry.enabled }
  })
  const result = { skillsPaths: [...new Set(value.skillsPaths)], mcp }
  if (Buffer.byteLength(JSON.stringify(result, null, 2)) > 65536)
    throw new Error("Extension settings exceed the size limit")
  return result
}

function privateFile(file) {
  if (!path.isAbsolute(file)) throw new Error("Invalid extension file")
  const parent = lstatSync(path.dirname(file))
  if (!parent.isDirectory() || parent.uid !== process.getuid() || parent.mode & 0o077)
    throw new Error("Extension directory must be private")
  if (!existsSync(file)) return
  const info = lstatSync(file)
  if (!info.isFile() || info.uid !== process.getuid() || info.mode & 0o077 || info.size > 65536)
    throw new Error("Extension file must be private and bounded")
}

export function loadExtensions(file) {
  if (!file) return { skillsPaths: [], mcp: [] }
  privateFile(file)
  return existsSync(file) ? validateExtensions(JSON.parse(readFileSync(file, "utf8"))) : { skillsPaths: [], mcp: [] }
}

export function saveExtensions(file, value) {
  const next = validateExtensions(value)
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 })
  privateFile(file)
  const temporary = `${file}.${randomUUID()}.tmp`
  writeFileSync(temporary, JSON.stringify(next, null, 2), { flag: "wx", mode: 0o600 })
  renameSync(temporary, file)
  return next
}

export function extensionState(file) {
  const value = loadExtensions(file)
  return { ...value, revision: createHash("sha256").update(JSON.stringify(value)).digest("hex") }
}

export function saveExtensionState(file, value) {
  if (
    !value ||
    typeof value !== "object" ||
    typeof value.revision !== "string" ||
    Object.keys(value).some((key) => !["skillsPaths", "mcp", "revision"].includes(key))
  )
    throw new Error("Invalid extension state")
  if (extensionState(file).revision !== value.revision)
    throw new Error("Extension settings changed in another window; reload before saving")
  saveExtensions(file, { skillsPaths: value.skillsPaths, mcp: value.mcp })
  return extensionState(file)
}
