import { spawnSync } from "node:child_process"
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  lstatSync,
  existsSync,
  renameSync,
  symlinkSync,
  unlinkSync,
} from "node:fs"
import { homedir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { desktopConfig } from "./config.mjs"
import { checkKey } from "./hub-client.mjs"

export function prepare() {
  const root = path.join(homedir(), ".local/share/modelhub-opencode/profiles")
  const home = path.join(root, "desktop")
  const dirs = Object.fromEntries(
    ["config", "data", "cache", "state", "bindings"].map((name) => [name, path.join(home, name)]),
  )
  for (const dir of [home, ...Object.values(dirs)]) {
    mkdirSync(dir, { recursive: true, mode: 0o700 })
    const stat = lstatSync(dir)
    if (!stat.isDirectory() || stat.uid !== process.getuid() || stat.mode & 0o077)
      throw new Error("配置目录必须属于当前用户，权限0700")
  }
  const env = {}
  for (const name of ["HOME", "PATH", "USER", "LOGNAME", "SHELL", "LANG", "LC_ALL", "TERM", "TMPDIR", "SSH_AUTH_SOCK"])
    if (process.env[name]) env[name] = process.env[name]
  for (const role of ["arona", "prana"]) {
    const keyFile = path.join(root, role, "key.json"),
      stat = lstatSync(keyFile)
    if (!stat.isFile() || stat.uid !== process.getuid() || stat.mode & 0o077)
      throw new Error("密钥文件必须属于当前用户，权限0600")
    const source = JSON.parse(readFileSync(keyFile, "utf8"))
    if (source.role !== role) throw new Error("密钥归属不一致")
    env[`MODELHUB_${role.toUpperCase()}_KEY`] = checkKey(source.key)
  }
  const extensionsFile = path.join(home, "extensions.json")
  const config = desktopConfig(fileURLToPath(new URL("./plugin.mjs", import.meta.url)))
  const file = path.join(dirs.config, "opencode.json"),
    temp = file + "." + process.pid + ".tmp"
  writeFileSync(temp, JSON.stringify(config, null, 2), { mode: 0o600, flag: "wx" })
  renameSync(temp, file)
  const dependency = path.join(dirs.config, "opencode")
  mkdirSync(dependency, { mode: 0o700, recursive: true })
  for (const name of ["package.json", "package-lock.json"])
    writeFileSync(path.join(dependency, name), readFileSync(fileURLToPath(new URL(name, import.meta.url))), {
      mode: 0o600,
    })
  const modules = path.join(dependency, "node_modules")
  if (existsSync(modules)) {
    const stat = lstatSync(modules)
    if (stat.uid !== process.getuid() || (!stat.isSymbolicLink() && !stat.isDirectory()))
      throw new Error("依赖入口不属于当前用户")
    if (stat.isSymbolicLink()) unlinkSync(modules)
  }
  if (!existsSync(modules)) symlinkSync(fileURLToPath(new URL("./node_modules", import.meta.url)), modules)
  Object.assign(env, {
    XDG_CONFIG_HOME: dirs.config,
    XDG_DATA_HOME: dirs.data,
    XDG_CACHE_HOME: dirs.cache,
    XDG_STATE_HOME: dirs.state,
    OPENCODE_TEST_HOME: home,
    OPENCODE_CONFIG: file,
    OPENCODE_CONFIG_CONTENT: JSON.stringify(config),
    OPENCODE_DISABLE_PROJECT_CONFIG: "1",
    OPENCODE_DISABLE_MODELS_FETCH: "1",
    OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER: "1",
    MODELHUB_BINDINGS_DIR: dirs.bindings,
    MODELHUB_EXTENSIONS_FILE: extensionsFile,
  })
  return { home, env }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const action = process.argv[2]
    if (!action) {
      const app = path.join(homedir(), "Applications/OpenCode Model Hub.app")
      if (!existsSync(app)) throw new Error("请先安装 OpenCode Model Hub.app；桌面入口直接使用应用程序")
      const result = spawnSync("/usr/bin/open", [app], { stdio: "ignore" })
      if (result.error || result.status !== 0) throw new Error("无法打开 OpenCode Model Hub.app")
    } else if (action === "--check") {
      const p = prepare()
      console.log(
        JSON.stringify({
          roles: ["arona", "prana"],
          home: p.home,
          key: "two dedicated role keys configured",
          api: "not called",
        }),
      )
    } else if (action === "--config-check") {
      const p = prepare()
      const cli = path.join(
        homedir(),
        ".local/share/modelhub-opencode/runtime/node_modules/opencode-darwin-arm64/bin/opencode",
      )
      const r = spawnSync(cli, ["debug", "config"], {
        env: p.env,
        encoding: "utf8",
        timeout: 60000,
        maxBuffer: 4 * 1024 * 1024,
      })
      if (r.status !== 0) throw new Error("官方配置解析失败，未输出配置或凭据")
      const value = JSON.parse(r.stdout)
      if (value.enabled_providers.join() !== "modelhub-arona,modelhub-prana") throw new Error("角色配置不匹配")
      console.log("两个角色配置解析成功，未调用模型")
    } else throw new Error("支持 --check、--config-check 或启动桌面应用")
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
