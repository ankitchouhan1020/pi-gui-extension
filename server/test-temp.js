/**
 * Temp project cwd for hub/http tests + cleanup of linked pi session dirs.
 * Pi stores JSONL under ~/.pi/agent/sessions/--encoded-cwd--/ (not inside the temp folder).
 */
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

/** Same encoding as hub.js defaultSessionDir / pi getDefaultSessionDir. */
export function sessionDirForCwd(cwd) {
  const resolvedCwd = resolve(cwd);
  const safePath = `--${resolvedCwd.replace(/^[/\\]/, "").replace(/[/\\:]/g, "-")}--`;
  return join(getAgentDir(), "sessions", safePath);
}

/** @param {string} prefix e.g. "pi-gui-hub-" */
export function makeTestCwd(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

function isUnderDir(parent, child) {
  const p = resolve(parent);
  const c = resolve(child);
  return c === p || c.startsWith(p + sep);
}

/**
 * Remove temp cwd and the pi session directory linked to that cwd.
 * Only deletes session dirs when cwd lives under os.tmpdir() (never real project sessions).
 * @param {string | undefined | null} cwd
 */
export function cleanupTestCwd(cwd) {
  if (!cwd || typeof cwd !== "string") return;
  const abs = resolve(cwd);
  if (!isUnderDir(tmpdir(), abs)) return;

  try {
    rmSync(abs, { recursive: true, force: true });
  } catch {
    /* ignore */
  }

  try {
    const sess = sessionDirForCwd(abs);
    if (existsSync(sess)) {
      rmSync(sess, { recursive: true, force: true });
    }
  } catch {
    /* ignore */
  }
}
