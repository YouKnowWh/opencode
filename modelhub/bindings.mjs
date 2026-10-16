import { mkdirSync, lstatSync, readFileSync, writeFileSync, renameSync } from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"

export function modelRole(model) {
  for (const role of ["arona", "prana"])
    if (model?.providerID === `modelhub-${role}` && (model.modelID ?? model.id) === role) return role
  throw new Error("请使用 Model Hub 角色模型")
}

export class RoleBindings {
  constructor(root) {
    if (!root) throw new Error("缺少角色会话目录")
    mkdirSync(root, { recursive: true, mode: 0o700 })
    const stat = lstatSync(root)
    if (!stat.isDirectory() || stat.uid !== process.getuid() || stat.mode & 0o077)
      throw new Error("角色会话目录须属于当前用户，权限0700")
    this.root = root
  }
  file(session) {
    if (!/^ses_[a-zA-Z0-9_-]{1,180}$/.test(session)) throw new Error("无效会话标识")
    return path.join(this.root, session + ".json")
  }
  get(session) {
    const file = this.file(session)
    let stat
    try {
      stat = lstatSync(file)
    } catch (error) {
      if (error.code === "ENOENT") return
      throw error
    }
    if (!stat.isFile() || stat.uid !== process.getuid() || stat.mode & 0o077) throw new Error("角色会话文件不安全")
    const role = JSON.parse(readFileSync(file, "utf8")).role
    if (!["arona", "prana"].includes(role)) throw new Error("会话角色无效")
    return role
  }
  select(session, role) {
    if (!["arona", "prana"].includes(role)) throw new Error("会话角色无效")
    this.get(session) // Validate any existing file before replacing the current selection.
    const file = this.file(session)
    const temp = file + "." + randomUUID() + ".tmp"
    writeFileSync(temp, JSON.stringify({ role }), { mode: 0o600, flag: "wx" })
    renameSync(temp, file)
    return role
  }
}
