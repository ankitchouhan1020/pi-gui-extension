/**
 * Detect file-ish paths in tool output and open in an editor when clicked.
 * Prefer Cursor / VS Code URI schemes (localhost agent UI).
 */

/** Absolute or relative path-like tokens (conservative). */
const PATH_RE =
  /(?:^|[\s"'`:=(\[{,])((?:\/(?:[\w.+@$-]+\/)*[\w.+@$-]+(?:\.\w+)?)|(?:\.\.?\/(?:[\w.+@$-]+\/)*[\w.+@$-]+(?:\.\w+)?)|(?:[A-Za-z]:\\(?:[\w.+@$-]+\\)*[\w.+@$-]+(?:\.\w+)?))/g;

export type PathSeg = { type: "text"; value: string } | { type: "path"; value: string };

export function splitPaths(text: string): PathSeg[] {
  if (!text) return [];
  const out: PathSeg[] = [];
  let last = 0;
  PATH_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PATH_RE.exec(text)) !== null) {
    const full = m[0];
    const path = m[1];
    const pathStart = m.index + full.length - path.length;
    if (pathStart > last) out.push({ type: "text", value: text.slice(last, pathStart) });
    // skip bare short tokens like "/a" or "x/y" without extension if only one segment
    if (looksLikePath(path)) out.push({ type: "path", value: path });
    else out.push({ type: "text", value: path });
    last = pathStart + path.length;
  }
  if (last < text.length) out.push({ type: "text", value: text.slice(last) });
  return out.length ? out : [{ type: "text", value: text }];
}

function looksLikePath(p: string): boolean {
  if (p.length < 3) return false;
  // need a slash or backslash + something interesting
  if (!/[\\/]/.test(p)) return false;
  // absolute unix, drive, or relative ./
  if (p.startsWith("/") || p.startsWith("./") || p.startsWith("../") || /^[A-Za-z]:\\/.test(p)) {
    return true;
  }
  return false;
}

/** Open path in Cursor/VS Code; falls back to copy. */
export async function openPath(path: string): Promise<"opened" | "copied"> {
  const abs = path.startsWith("/") || /^[A-Za-z]:\\/.test(path) ? path : path;
  // Cursor first (this project’s usual editor), then VS Code
  const uris = [
    `cursor://file${abs.startsWith("/") ? abs : `/${abs}`}`,
    `vscode://file${abs.startsWith("/") ? abs : `/${abs}`}`,
  ];
  for (const href of uris) {
    try {
      // Hidden anchor — window.open often blocked for custom schemes
      const a = document.createElement("a");
      a.href = href;
      a.rel = "noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
      return "opened";
    } catch {
      /* try next */
    }
  }
  try {
    await navigator.clipboard.writeText(path);
    return "copied";
  } catch {
    return "copied";
  }
}
