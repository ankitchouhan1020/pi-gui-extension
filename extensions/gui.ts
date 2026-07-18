/**
 * Pi extension: /gui starts localhost web UI in-process and attaches the live session.
 *
 * Install: pi install /path/to/pi-gui
 * Or: pi -e ./extensions/gui.ts
 */
import {
  AgentSession,
  type ExtensionAPI,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { spawn } from "node:child_process";
import { createServer } from "../server/http.js";
import { hub } from "../server/hub.js";

/**
 * Index live AgentSession by id. Must patch the same AgentSession class pi uses
 * (import here via jiti aliases — not via server/session-index.js nested resolve).
 */
const sessionsById = new Map<string, InstanceType<typeof AgentSession>>();
/** Hub ids of live-attached TUI sessions (multi-bind; detach per session). */
const boundIds = new Set<string>();
(function ensureSessionIndex() {
  const proto = AgentSession.prototype as {
    subscribe: (listener: (ev: unknown) => void) => () => void;
    dispose: () => void;
    sessionId?: string;
  };
  if ((proto.subscribe as { __piGui?: boolean }).__piGui) return;
  const origSub = proto.subscribe;
  proto.subscribe = function subscribeIndexed(this: { sessionId?: string }, listener) {
    try {
      if (this.sessionId) sessionsById.set(this.sessionId, this as InstanceType<typeof AgentSession>);
    } catch {
      /* ignore */
    }
    return origSub.call(this, listener);
  };
  (proto.subscribe as { __piGui?: boolean }).__piGui = true;
  const origDispose = proto.dispose;
  proto.dispose = function disposeIndexed(this: { sessionId?: string }) {
    try {
      if (this.sessionId) {
        sessionsById.delete(this.sessionId);
        // Drop live hub bind if this was a TUI-attached session
        if (boundIds.has(this.sessionId)) {
          hub.detach(this.sessionId);
          boundIds.delete(this.sessionId);
        }
      }
    } catch {
      /* ignore */
    }
    return origDispose.call(this);
  };
})();

function getSessionById(id: string) {
  return sessionsById.get(id) ?? null;
}

/** @type {ReturnType<typeof createServer> | null} */
let app: ReturnType<typeof createServer> | null = null;

const DEFAULT_PORT = Number(process.env.PI_GUI_PORT || 3847);

/**
 * Parse `/gui` args.
 * - `/gui` · `/gui 4000` — live-attach current session
 * - `/gui <sessionId|path>` · `/gui open <id>` — open that session in the UI
 * - `/gui stop`
 */
export function parseArgs(raw?: string): {
  cmd: "start" | "stop";
  port: number;
  /** Session id or disk path to open (omit = current TUI session). */
  sessionRef?: string;
} {
  const parts = (raw ?? "").trim().split(/\s+/).filter(Boolean);
  let cmd: "start" | "stop" = "start";
  let port = DEFAULT_PORT;
  let sessionRef: string | undefined;
  for (const p of parts) {
    if (p === "stop") {
      cmd = "stop";
      continue;
    }
    // verbs / aliases — not session refs
    if (p === "start" || p === "takeover" || p === "open") continue;
    // port: 1–65535 only (session ids are UUIDs / paths, not bare small ints)
    if (/^\d{1,5}$/.test(p)) {
      const n = Number(p);
      if (n >= 1 && n <= 65535) {
        port = n;
        continue;
      }
    }
    sessionRef = p;
  }
  return { cmd, port, sessionRef };
}

async function isUp(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}

function attachLive(ctx: ExtensionContext): { id: string } | null {
  const id = ctx.sessionManager.getSessionId();
  return attachSessionById(id, ctx.cwd);
}

/**
 * Live-attach an in-process AgentSession (TUI) by id.
 * @param {string} id
 * @param {string} [cwd]
 */
function attachSessionById(id: string, cwd?: string): { id: string } | null {
  const session = getSessionById(id);
  if (!session) return null;
  const meta = hub.attach(session, { cwd: cwd || process.cwd() });
  boundIds.add(meta.id);
  return meta;
}

/**
 * Resolve session ref → hub id: live attach if possible, else open from disk.
 * @returns hub session id
 */
async function resolveSessionInHub(
  sessionRef: string | undefined,
  ctx: ExtensionContext,
): Promise<{ id: string; live: boolean }> {
  const currentId = ctx.sessionManager.getSessionId();
  const ref = (sessionRef || currentId || "").trim();
  if (!ref) {
    throw new Error("no session id (pass /gui <sessionId> or use in a live session)");
  }

  // Current TUI session → live attach
  if (!sessionRef || ref === currentId) {
    const meta = attachLive(ctx);
    if (meta) return { id: meta.id, live: true };
    // Fall through: maybe only on disk
  }

  // Another live AgentSession in this process (indexed via subscribe)
  const live = attachSessionById(ref, ctx.cwd);
  if (live) return { id: live.id, live: true };

  // Disk / already-open hub session
  const opened = await hub.ensure(ref);
  return { id: opened.id, live: Boolean(opened.bound) };
}

/** Detach one session, or all if id omitted. */
function detachLive(id?: string | null): void {
  if (id) {
    hub.detach(id);
    boundIds.delete(id);
    return;
  }
  for (const bid of [...boundIds]) {
    hub.detach(bid);
  }
  boundIds.clear();
}

async function waitUntilDown(port: number, ms = 5000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (!(await isUp(port))) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return !(await isUp(port));
}

async function startServer(port: number): Promise<void> {
  if (app) return;
  if (await isUp(port)) return;

  const next = createServer({ port, stayAlive: true });
  await new Promise<void>((resolve, reject) => {
    const onErr = (err: Error) => {
      next.server.off("error", onErr);
      reject(err);
    };
    next.server.once("error", onErr);
    next.listen(() => {
      next.server.off("error", onErr);
      resolve();
    });
  });
  app = next;
}

/**
 * Ensure this TUI process owns the HTTP host so hub.attach is live.
 * If another process holds the port, shut it down first (automatic takeover).
 */
async function ensureServer(
  port: number,
  notify: (msg: string) => void,
): Promise<void> {
  if (app) return;

  if (await isUp(port)) {
    notify(`Taking over pi-gui on :${port} for live session…`);
    await stopServer(port);
    if (!(await waitUntilDown(port))) {
      throw new Error(
        `port ${port} still busy after shutdown — free it or run /gui stop there`,
      );
    }
  } else {
    notify("Starting pi-gui…");
  }

  await startServer(port);
  if (!app) {
    throw new Error(`failed to bind pi-gui on :${port}`);
  }
}

async function stopServer(port: number): Promise<"stopped" | "not_running"> {
  if (app) {
    detachLive();
    const cur = app;
    app = null;
    try {
      await cur.close();
    } catch {
      /* ignore */
    }
    return "stopped";
  }

  if (!(await isUp(port))) return "not_running";

  // Foreign/standalone server — ask it to exit (or close if stayAlive)
  try {
    await fetch(`http://127.0.0.1:${port}/api/shutdown`, { method: "POST" });
  } catch {
    /* process exits mid-response — expected */
  }

  return (await waitUntilDown(port, 3000)) ? "stopped" : "not_running";
}

function openBrowser(url: string): void {
  const openCmd =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "start"
        : "xdg-open";
  spawn(openCmd, [url], {
    stdio: "ignore",
    shell: process.platform === "win32",
  });
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("gui", {
    description:
      "Open pi-gui. /gui · /gui <sessionId> · /gui open <id> · /gui stop. Takes over port if needed.",
    handler: async (args, ctx) => {
      const { cmd, port, sessionRef } = parseArgs(args);
      const base = `http://127.0.0.1:${port}`;

      try {
        if (cmd === "stop") {
          const result = await stopServer(port);
          if (result === "not_running") {
            ctx.ui.notify(`pi-gui not running on :${port}`, "info");
          } else {
            ctx.ui.notify(`pi-gui stopped (:${port})`, "info");
          }
          return;
        }

        // Own host (take over foreign process if needed).
        await ensureServer(port, (msg) => ctx.ui.notify(msg, "info"));

        // Current session, or explicit /gui <sessionId> / /gui open <id>
        const { id, live } = await resolveSessionInHub(sessionRef, ctx);
        const url = `${base}/sessions/${encodeURIComponent(id)}`;
        ctx.ui.notify(
          live ? `pi-gui: ${url} (live)` : `pi-gui: ${url}`,
          "info",
        );
        openBrowser(url);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        ctx.ui.notify(`pi-gui failed: ${msg}`, "error");
      }
    },
  });

  // Attach each new TUI session without dropping others (multi-live).
  // Hub-owned sessions also load this extension with mode "rpc" — ignore those.
  pi.on("session_start", (_event, ctx) => {
    if (!app || ctx.mode !== "tui") return;
    attachLive(ctx);
  });

  // Per-session detach on replace; tear down HTTP only on full TUI quit.
  pi.on("session_shutdown", async (event, ctx) => {
    if (ctx.mode !== "tui") return;
    if (event.reason !== "quit") {
      try {
        detachLive(ctx.sessionManager.getSessionId());
      } catch {
        detachLive();
      }
      return;
    }
    if (app) {
      await stopServer(app.port);
    }
  });
}
