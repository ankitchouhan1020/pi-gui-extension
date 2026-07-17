/**
 * Pi extension: /gui starts the localhost web UI; /gui stop shuts it down.
 *
 * Install: pi install /path/to/pi-gui
 * Or: pi -e ./extensions/gui.ts
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { spawn, type ChildProcess } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function packageRoot(): string {
  // extensions/gui.ts → package root
  try {
    return dirname(dirname(fileURLToPath(import.meta.url)));
  } catch {
    return process.cwd();
  }
}

let child: ChildProcess | null = null;
const DEFAULT_PORT = Number(process.env.PI_GUI_PORT || 3847);

function parseArgs(raw?: string): { cmd: "start" | "stop"; port: number } {
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

function startServer(port: number): Promise<void> {
  if (child && !child.killed) return Promise.resolve();

  const root = packageRoot();
  const cli = join(root, "server", "cli.js");

  return new Promise((resolve, reject) => {
    child = spawn(process.execPath, [cli, "--port", String(port)], {
      cwd: root,
      env: { ...process.env, PI_GUI_PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });

    let settled = false;
    const done = (err?: Error) => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve();
    };

    child.stdout?.on("data", (buf) => {
      const s = buf.toString();
      if (s.includes("http://")) done();
    });
    child.stderr?.on("data", (buf) => {
      console.error("[pi-gui]", buf.toString());
    });
    child.on("error", (err) => done(err));
    child.on("exit", (code) => {
      child = null;
      if (!settled) done(new Error(`pi-gui exited with code ${code}`));
    });

    // Fallback resolve after health checks
    const start = Date.now();
    const poll = setInterval(async () => {
      if (await isUp(port)) {
        clearInterval(poll);
        done();
      } else if (Date.now() - start > 8000) {
        clearInterval(poll);
        done(new Error("pi-gui failed to start within 8s"));
      }
    }, 200);
  });
}

async function stopServer(port: number): Promise<"stopped" | "not_running"> {
  // Prefer killing the child we spawned
  if (child && !child.killed) {
    const proc = child;
    child = null;
    await new Promise<void>((resolve) => {
      const t = setTimeout(() => {
        try {
          proc.kill("SIGKILL");
        } catch {
          /* ignore */
        }
        resolve();
      }, 2000);
      proc.once("exit", () => {
        clearTimeout(t);
        resolve();
      });
      try {
        proc.kill("SIGTERM");
      } catch {
        clearTimeout(t);
        resolve();
      }
    });
    return "stopped";
  }

  if (!(await isUp(port))) return "not_running";

  // Server started elsewhere (npm run dev:server) — ask it to exit
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

export default function (pi: ExtensionAPI) {
  pi.registerCommand("gui", {
    description: "Open pi-gui web UI. Use /gui stop to shut it down.",
    handler: async (args, ctx) => {
      const { cmd, port } = parseArgs(args);
      const url = `http://127.0.0.1:${port}`;

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

        if (!(await isUp(port))) {
          ctx.ui.notify("Starting pi-gui…", "info");
          await startServer(port);
        }
        ctx.ui.notify(`pi-gui: ${url}`, "info");

        // Best-effort open browser (macOS/linux)
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
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        ctx.ui.notify(`pi-gui failed: ${msg}`, "error");
      }
    },
  });

  pi.on("session_shutdown", async () => {
    if (child && !child.killed) {
      child.kill("SIGTERM");
      child = null;
    }
  });
}
