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
      if (this.sessionId) sessionsById.delete(this.sessionId);
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
/** Hub id of the attached TUI session, if any. */
let boundId: string | null = null;

const DEFAULT_PORT = Number(process.env.PI_GUI_PORT || 3847);

/** Exported for unit tests. */
export function parseArgs(raw?: string): { cmd: "start" | "stop"; port: number } {
  const parts = (raw ?? "").trim().split(/\s+/).filter(Boolean);
  let cmd: "start" | "stop" = "start";
  let port = DEFAULT_PORT;
  for (const p of parts) {
    if (p === "stop" || p === "start") cmd = p;
    else if (/^\d+$/.test(p)) port = Number(p) || DEFAULT_PORT;
  }
  return { cmd, port };
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
  const session = getSessionById(id);
  if (!session) return null;
  const meta = hub.attach(session, { cwd: ctx.cwd });
  boundId = meta.id;
  return meta;
}

function detachLive(): void {
  if (boundId) {
    hub.detach(boundId);
    boundId = null;
  }
}

async function startServer(port: number): Promise<void> {
  if (app) return;

  // Another process already serving this port — don't take over.
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

  // Foreign/standalone server — ask it to exit
  try {
    await fetch(`http://127.0.0.1:${port}/api/shutdown`, { method: "POST" });
  } catch {
    /* process exits mid-response — expected */
  }

  const start = Date.now();
  while (Date.now() - start < 3000) {
    if (!(await isUp(port))) return "stopped";
    await new Promise((r) => setTimeout(r, 100));
  }
  return (await isUp(port)) ? "not_running" : "stopped";
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
    description: "Open pi-gui web UI (same process + live session). /gui stop to shut down.",
    handler: async (args, ctx) => {
      const { cmd, port } = parseArgs(args);
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

        if (!app) {
          if (await isUp(port)) {
            // Foreign server already up — open browser, no live attach.
            ctx.ui.notify(`pi-gui already running: ${base}`, "info");
            openBrowser(base);
            return;
          }
          ctx.ui.notify("Starting pi-gui…", "info");
          await startServer(port);
        }

        const meta = attachLive(ctx);
        const url = meta ? `${base}/sessions/${encodeURIComponent(meta.id)}` : base;
        ctx.ui.notify(
          meta ? `pi-gui: ${url} (live session)` : `pi-gui: ${url}`,
          "info",
        );
        openBrowser(url);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        ctx.ui.notify(`pi-gui failed: ${msg}`, "error");
      }
    },
  });

  // Rebind when TUI replaces the session (/new, /resume, fork).
  // Hub-owned sessions also load this extension with mode "rpc" — ignore those.
  pi.on("session_start", (_event, ctx) => {
    if (!app || ctx.mode !== "tui") return;
    detachLive();
    attachLive(ctx);
  });

  // Only tear down HTTP on full TUI quit — not on session replace/reload.
  pi.on("session_shutdown", async (event, ctx) => {
    if (ctx.mode !== "tui") return;
    if (event.reason !== "quit") {
      detachLive();
      return;
    }
    if (app) {
      await stopServer(app.port);
    }
  });
}
