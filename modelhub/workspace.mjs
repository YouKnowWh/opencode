import { createHash } from "node:crypto"
import { realpathSync } from "node:fs"
import path from "node:path"

export function workspaceIdentity(directory, worktree) {
  if (!directory) return undefined
  const current = realpathSync(directory)
  const root = worktree && worktree !== path.parse(worktree).root ? realpathSync(worktree) : current
  const relative = path.relative(root, current)
  const selected =
    relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
      ? root
      : current
  // Keep the real directory path on the client. The ID is a retrieval partition,
  // while each request still authenticates with its executing role's own key.
  return "ws_" + createHash("sha256").update(selected).digest("hex")
}
