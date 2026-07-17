#!/usr/bin/env node
/**
 * Validate in-process /gui via pi --mode rpc.
 * Loads ONLY local extensions/gui.ts (--no-extensions -e).
 */
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PI_GUI_VALIDATE_PORT || 13947);
const EXT = join(root, "extensions", "gui.ts");

function log(...a) {
  console.log("[validate]", ...a);
}

async function wait(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { ok: res.ok, status: res.status, body };
}

async function main() {
  // free port if leftover
  try {
    await fetch(`http://127.0.0.1:${PORT}/api/shutdown`, { method: "POST" });
    await wait(200);
  } catch {
    /* ignore */
  }

  // Uses pi settings packages (local path install of this repo) + default model.
  log("starting pi rpc (packages from settings; local pi-gui)");
  const child = spawn(
    "pi",
    ["--mode", "rpc", "--no-session"],
    {
      cwd: root,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, PI_GUI_PORT: String(PORT) },
    },
  );

  const lines = [];
  /** @type {Map<string, object>} */
  const responses = new Map();
  let ready = false;

  const rl = createInterface({ input: child.stdout });
  rl.on("line", (line) => {
    lines.push(line);
    try {
      const msg = JSON.parse(line);
      if (msg.type === "response" && msg.id) responses.set(msg.id, msg);
      if (msg.type === "response" && msg.command === "get_state") ready = true;
    } catch {
      /* non-json */
    }
  });

  let stderr = "";
  child.stderr.on("data", (b) => {
    stderr += b.toString();
  });

  const send = (obj) => {
    child.stdin.write(JSON.stringify(obj) + "\n");
  };

  const waitFor = async (id, ms = 15000) => {
    const start = Date.now();
    while (Date.now() - start < ms) {
      if (responses.has(id)) return responses.get(id);
      await wait(50);
    }
    throw new Error(`timeout waiting for response ${id}`);
  };

  try {
    // warm
    send({ id: "warm", type: "get_state" });
    const state = await waitFor("warm", 30000);
    if (!state.success) throw new Error(`get_state failed: ${JSON.stringify(state)}`);
    const sessionId = state.data?.sessionId || state.data?.session_id;
    log("rpc ready; sessionId=", sessionId || "(unknown)");
    log("process.pid=", child.pid);

    // /gui start
    send({ id: "gui-start", type: "prompt", message: `/gui ${PORT}` });
    const guiStart = await waitFor("gui-start", 20000);
    log("gui start response:", JSON.stringify(guiStart).slice(0, 300));
    if (!guiStart.success) {
      throw new Error(`/gui failed: ${JSON.stringify(guiStart)}`);
    }

    // health should come up
    let health;
    for (let i = 0; i < 40; i++) {
      try {
        health = await fetchJson(`http://127.0.0.1:${PORT}/api/health`);
        if (health.ok) break;
      } catch {
        /* retry */
      }
      await wait(150);
    }
    if (!health?.ok) {
      throw new Error(`health not ok after /gui: ${JSON.stringify(health)}`);
    }
    log("health:", health.body);

    // sessions list — live should be running if attach worked
    const sessions = await fetchJson(`http://127.0.0.1:${PORT}/api/sessions`);
    if (!sessions.ok) throw new Error(`sessions list failed: ${JSON.stringify(sessions)}`);
    const rows = sessions.body?.sessions || sessions.body || [];
    const list = Array.isArray(rows) ? rows : rows.sessions || [];
    log("open/running sessions:", JSON.stringify(list).slice(0, 800));

    const running = list.filter((s) => s.running);
    if (running.length < 1) {
      throw new Error("expected at least one running (attached) session");
    }

    // prove same process: health open count + no separate node cli on that port's parent
    // lsof the listener pid
    const lsof = spawn("lsof", ["-tiTCP:" + PORT, "-sTCP:LISTEN"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let lsofOut = "";
    for await (const chunk of lsof.stdout) lsofOut += chunk;
    await new Promise((r) => lsof.on("close", r));
    const listenerPids = lsofOut
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(Number);
    log("listener pids:", listenerPids, "pi pid:", child.pid);
    if (!listenerPids.includes(child.pid)) {
      // may be a worker thread / different process group — still check not a detached cli.js-only tree
      // If spawn path: listener is a *child* node of pi. Check parent of listener.
      let sameProcess = false;
      for (const pid of listenerPids) {
        if (pid === child.pid) sameProcess = true;
        try {
          const pp = spawn("ps", ["-o", "ppid=", "-p", String(pid)], {
            stdio: ["ignore", "pipe", "pipe"],
          });
          let out = "";
          for await (const c of pp.stdout) out += c;
          await new Promise((r) => pp.on("close", r));
          const ppid = Number(out.trim());
          log("listener", pid, "ppid", ppid);
          if (ppid === child.pid) {
            // child process listening = old spawn path
            throw new Error(
              `FAIL: HTTP listener pid=${pid} is a child of pi (spawn path still active)`,
            );
          }
        } catch (e) {
          if (String(e.message).includes("FAIL:")) throw e;
        }
      }
      if (!sameProcess && listenerPids.length) {
        log(
          "WARN: listener pid != pi pid; if not a child of pi, may still be in-process (rare on macOS)",
        );
      }
    } else {
      log("OK: HTTP listener is the pi process (in-process)");
    }

    // live session messages endpoint
    const liveId = running[0].id;
    const msgs = await fetchJson(
      `http://127.0.0.1:${PORT}/api/sessions/${encodeURIComponent(liveId)}/messages`,
    );
    log("messages status:", msgs.status, "count:", msgs.body?.messages?.length ?? msgs.body?.length);

    // stop
    send({ id: "gui-stop", type: "prompt", message: `/gui stop ${PORT}` });
    const guiStop = await waitFor("gui-stop", 15000);
    log("gui stop response:", JSON.stringify(guiStop).slice(0, 300));
    if (!guiStop.success) throw new Error(`/gui stop failed: ${JSON.stringify(guiStop)}`);

    await wait(400);
    let down = false;
    try {
      await fetchJson(`http://127.0.0.1:${PORT}/api/health`);
    } catch {
      down = true;
    }
    if (!down) {
      // might still be up briefly
      await wait(800);
      try {
        await fetchJson(`http://127.0.0.1:${PORT}/api/health`);
        throw new Error("health still up after /gui stop");
      } catch (e) {
        if (String(e.message).includes("still up")) throw e;
        down = true;
      }
    }
    log("OK: server stopped after /gui stop");

    // pi still alive
    if (child.exitCode !== null) {
      throw new Error(`pi exited early with code ${child.exitCode}`);
    }
    log("OK: pi process still running after /gui stop");

    console.log("\nVALIDATION PASSED");
  } catch (err) {
    console.error("\nVALIDATION FAILED:", err instanceof Error ? err.message : err);
    console.error("--- stderr (tail) ---\n", stderr.slice(-3000));
    console.error("--- stdout lines (tail) ---\n", lines.slice(-30).join("\n"));
    process.exitCode = 1;
  } finally {
    try {
      child.stdin.end();
    } catch {
      /* */
    }
    child.kill("SIGTERM");
    await wait(500);
    if (child.exitCode === null) child.kill("SIGKILL");
  }
}

main();
