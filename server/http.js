/**
 * Minimal HTTP + SSE API for pi-gui.
 * No framework — node:http only (ponytail).
 */
import http from "node:http";
import { execFile } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hub } from "./hub.js";
import {
  connectedPayload,
  shouldReplayRing,
} from "./sse-protocol.js";

/**
 * Host lifecycle for /api/shutdown (extension stays alive while the host closes).
 * @type {{ stayAlive: boolean, close: null | (() => Promise<unknown>) }}
 */
const hostCtl = { stayAlive: false, close: null };

/** @param {unknown} images */
function hasImages(images) {
  return Array.isArray(images) && images.length > 0;
}

/**
 * List subdirectories for the in-app folder browser (localhost only).
 * @param {string} [dirPath]
 */
async function listFsDirs(dirPath) {
  let resolved = path.resolve(
    dirPath && String(dirPath).trim()
      ? String(dirPath).trim()
      : process.cwd(),
  );
  if (!existsSync(resolved)) {
    // climb to nearest existing ancestor
    let cur = resolved;
    while (cur && !existsSync(cur)) {
      const parent = path.dirname(cur);
      if (parent === cur) break;
      cur = parent;
    }
    resolved = existsSync(cur) ? cur : process.cwd();
  }
  const st = await stat(resolved);
  if (!st.isDirectory()) {
    throw new Error("Not a directory");
  }
  const names = await readdir(resolved, { withFileTypes: true });
  const entries = names
    .filter((d) => d.isDirectory())
    .map((d) => ({
      name: d.name,
      path: path.join(resolved, d.name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const parent = path.dirname(resolved);
  return {
    path: resolved,
    parent: parent !== resolved ? parent : null,
    home: os.homedir(),
    entries,
  };
}

/**
 * Run git in cwd. Non-zero exit still returns stdout (e.g. diff --no-index).
 * @param {string} cwd
 * @param {string[]} args
 * @returns {Promise<{ code: number; stdout: string; stderr: string }>}
 */
function runGit(cwd, args) {
  return new Promise((resolve) => {
    execFile(
      "git",
      args,
      { cwd, maxBuffer: 12 * 1024 * 1024, encoding: "utf8" },
      (err, stdout, stderr) => {
        const code =
          err && typeof /** @type {{ code?: unknown }} */ (err).code === "number"
            ? /** @type {{ code: number }} */ (err).code
            : err
              ? 1
              : 0;
        resolve({
          code,
          stdout: typeof stdout === "string" ? stdout : "",
          stderr: typeof stderr === "string" ? stderr : "",
        });
      },
    );
  });
}

/** @param {string} xy */
function gitShortStatus(xy) {
  if (xy === "??" || xy === "!!") return "U";
  if (xy.includes("D")) return "D";
  if (xy[0] === "A" || xy[1] === "A") return "A";
  if (xy[0] === "R" || xy[1] === "R") return "R";
  if (xy[0] === "C" || xy[1] === "C") return "A";
  return "M";
}

/** @param {string} text */
function parsePorcelain(text) {
  /** @type {{ path: string; oldPath?: string; xy: string; status: string }[]} */
  const files = [];
  for (const line of text.split("\n")) {
    if (!line || line.length < 4) continue;
    const xy = line.slice(0, 2);
    let rest = line.slice(3);
    /** @type {string | undefined} */
    let oldPath;
    if (rest.includes(" -> ")) {
      const idx = rest.lastIndexOf(" -> ");
      oldPath = rest.slice(0, idx).replace(/^"(.*)"$/, "$1");
      rest = rest.slice(idx + 4);
    }
    const filePath = rest.replace(/^"(.*)"$/, "$1");
    if (!filePath) continue;
    files.push({
      path: filePath,
      ...(oldPath ? { oldPath } : {}),
      xy,
      status: gitShortStatus(xy),
    });
  }
  return files;
}

/**
 * Resolve rel under cwd; reject traversal.
 * @param {string} cwd
 * @param {string} rel
 */
function resolveUnderCwd(cwd, rel) {
  const root = path.resolve(cwd);
  const cleaned = String(rel || "")
    .replace(/\\/g, "/")
    .replace(/^\.?\//, "");
  if (!cleaned || cleaned.includes("\0")) throw new Error("invalid path");
  const abs = path.resolve(root, cleaned);
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    throw new Error("path outside workspace");
  }
  return { root, abs, rel: path.relative(root, abs).split(path.sep).join("/") };
}

/**
 * @param {string} cwd
 */
async function gitStatus(cwd) {
  const inside = await runGit(cwd, ["rev-parse", "--is-inside-work-tree"]);
  if (inside.code !== 0 || inside.stdout.trim() !== "true") {
    return { ok: false, error: "Not a git repository", cwd, files: [] };
  }
  const [branchR, porcR] = await Promise.all([
    runGit(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]),
    runGit(cwd, ["status", "--porcelain=v1", "-uall"]),
  ]);
  return {
    ok: true,
    cwd,
    branch: branchR.stdout.trim() || "HEAD",
    files: parsePorcelain(porcR.stdout),
  };
}

/**
 * Unified diff for one path vs HEAD (untracked → /dev/null).
 * @param {string} cwd
 * @param {string} filePath
 */
async function gitFileDiff(cwd, filePath) {
  const { rel } = resolveUnderCwd(cwd, filePath);
  const vsHead = await runGit(cwd, ["diff", "HEAD", "--", rel]);
  if (vsHead.stdout) {
    return { path: rel, patch: vsHead.stdout };
  }
  // staged-only: empty working tree diff vs HEAD can miss index — try cached+unstaged
  const cached = await runGit(cwd, ["diff", "--cached", "HEAD", "--", rel]);
  if (cached.stdout) {
    return { path: rel, patch: cached.stdout };
  }
  // untracked / new file
  const untracked = await runGit(cwd, [
    "diff",
    "--no-index",
    "--",
    "/dev/null",
    rel,
  ]);
  if (untracked.stdout) {
    return { path: rel, patch: untracked.stdout };
  }
  // deleted and nothing left
  const deleted = await runGit(cwd, ["diff", "HEAD", "--diff-filter=D", "--", rel]);
  return { path: rel, patch: deleted.stdout || "" };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const WEB_DIST = path.join(ROOT, "dist");
const WEB_DEV = process.env.PI_GUI_DEV === "1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".woff2": "font/woff2",
  ".json": "application/json",
  ".map": "application/json",
};

/**
 * @param {http.IncomingMessage} req
 */
async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw);
}

/**
 * @param {http.ServerResponse} res
 * @param {number} status
 * @param {unknown} body
 */
function json(res, status, body) {
  if (res.writableEnded) return;
  if (res.headersSent) {
    try {
      res.end();
    } catch {
      /* ignore */
    }
    return;
  }
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(data);
}

/**
 * @param {http.ServerResponse} res
 * @param {number} status
 * @param {string} [msg]
 */
function text(res, status, msg = "") {
  if (res.writableEnded) return;
  if (!res.headersSent) {
    res.writeHead(status, {
      "Content-Type": "text/plain; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    });
  }
  res.end(msg);
}

/**
 * @param {string} urlPath
 */
function parsePath(urlPath) {
  const u = new URL(urlPath, "http://localhost");
  return { pathname: u.pathname, searchParams: u.searchParams };
}

/** @param {string} pathname @param {string} suffix */
function sessionAction(pathname, suffix) {
  const m = pathname.match(
    new RegExp(`^/api/sessions/([^/]+)/${suffix}$`),
  );
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * Drop assistantMessageEvent.partial — it duplicates event.message and
 * doubles JSON cost on every token. UI only reads e.message.
 * @param {unknown} event
 */
/** @param {unknown} event */
export function slimSseEvent(event) {
  if (!event || typeof event !== "object") return event;
  const e = /** @type {Record<string, unknown>} */ (event);
  if (e.type !== "message_update") return event;
  const ame = e.assistantMessageEvent;
  if (!ame || typeof ame !== "object" || !("partial" in ame)) return event;
  const { partial: _, ...rest } = /** @type {Record<string, unknown>} */ (ame);
  return { ...e, assistantMessageEvent: rest };
}

/**
 * SSE frame with id so EventSource resumes via Last-Event-ID.
 * @param {unknown} event
 * @param {number} seq
 */
export function formatSseEvent(event, seq) {
  return `id: ${seq}\ndata: ${JSON.stringify(slimSseEvent(event))}\n\n`;
}

/** @param {http.IncomingMessage} req @param {URLSearchParams} searchParams */
function lastEventIdFrom(req, searchParams) {
  const h = req.headers["last-event-id"];
  const raw =
    (typeof h === "string" && h) ||
    searchParams.get("lastEventId") ||
    searchParams.get("after") ||
    "";
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
async function handleApi(req, res) {
  const { pathname, searchParams } = parsePath(req.url || "/");
  const method = req.method || "GET";

  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  try {
    // GET /api/health
    if (method === "GET" && pathname === "/api/health") {
      return json(res, 200, {
        ok: true,
        open: hub.listOpen().length,
        cwd: process.cwd(),
      });
    }

    // POST /api/shutdown — stop the HTTP host without exiting Pi
    if (method === "POST" && pathname === "/api/shutdown") {
      json(res, 200, { ok: true });
      setTimeout(() => {
        const done = hostCtl.close
          ? hostCtl.close()
          : Promise.resolve(hub.disposeAll());
        Promise.resolve(done)
          .catch(() => {})
          .finally(() => {
            if (!hostCtl.stayAlive) process.exit(0);
          });
      }, 50);
      return;
    }

    // GET /api/changelog — pi package CHANGELOG.md (for Cmd+K)
    if (method === "GET" && pathname === "/api/changelog") {
      const pkgDir = path.join(
        ROOT,
        "node_modules",
        "@earendil-works",
        "pi-coding-agent",
      );
      try {
        const [pkgRaw, textRaw] = await Promise.all([
          readFile(path.join(pkgDir, "package.json"), "utf8").catch(() => "{}"),
          readFile(path.join(pkgDir, "CHANGELOG.md"), "utf8"),
        ]);
        let version;
        try {
          version = JSON.parse(pkgRaw).version;
        } catch {
          /* ignore */
        }
        // Cap payload — full history is huge for a modal
        const text =
          textRaw.length > 80_000
            ? textRaw.slice(0, 80_000) + "\n\n… (truncated)"
            : textRaw;
        return json(res, 200, { version, text });
      } catch (e) {
        return json(res, 404, {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // GET /api/models?sessionId=
    if (method === "GET" && pathname === "/api/models") {
      const sessionId = searchParams.get("sessionId") || undefined;
      return json(res, 200, { models: await hub.listModels(sessionId) });
    }

    // GET /api/fs?path= — list subdirs for folder browser
    if (method === "GET" && pathname === "/api/fs") {
      try {
        const listed = await listFsDirs(searchParams.get("path") || undefined);
        return json(res, 200, listed);
      } catch (e) {
        return json(res, 400, {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // GET /api/sessions?cwd=
    if (method === "GET" && pathname === "/api/sessions") {
      const cwd = searchParams.get("cwd") || undefined;
      const sessions = await hub.list(cwd);
      return json(res, 200, { sessions });
    }

    // POST /api/sessions  { path?, cwd?, fresh?, content?, filename? }
    if (method === "POST" && pathname === "/api/sessions") {
      const body = await readJson(req);
      const opened = await hub.open({
        path: body.path,
        content: body.content,
        filename: body.filename,
        cwd: body.cwd,
        fresh: body.fresh ?? (!body.path && body.content == null),
      });
      return json(res, 200, opened);
    }

    // --- session sub-routes (more specific first) ---

    // GET /api/sessions/:id/messages
    let id = sessionAction(pathname, "messages");
    if (method === "GET" && id) {
      const s = await hub.ensure(id);
      return json(res, 200, { messages: hub.getMessages(s.id) });
    }

    // POST /api/sessions/:id/prompt  { message, images? }
    id = sessionAction(pathname, "prompt");
    if (method === "POST" && id) {
      const body = await readJson(req);
      if (typeof body.message !== "string") {
        return json(res, 400, { error: "message required" });
      }
      if (!body.message.trim() && !hasImages(body.images)) {
        return json(res, 400, { error: "message required" });
      }
      const s = await hub.ensure(id);
      // 202 fire-and-forget; hub.#failTurn emits error + agent_settled on failure
      hub.prompt(s.id, body.message, body.images).catch((err) => {
        console.error("[pi-gui] prompt error", s.id, err);
      });
      return json(res, 202, { ok: true, id: s.id });
    }

    // POST /api/sessions/:id/command  { command }
    id = sessionAction(pathname, "command");
    if (method === "POST" && id) {
      const body = await readJson(req);
      if (typeof body.command !== "string" || !/^\/\S+/.test(body.command.trim())) {
        return json(res, 400, { error: "command required" });
      }
      const s = await hub.ensure(id);
      try {
        return json(res, 200, await hub.command(s.id, body.command.trim()));
      } catch (e) {
        return json(res, 400, {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // POST /api/sessions/:id/abort
    id = sessionAction(pathname, "abort");
    if (method === "POST" && id) {
      const s = await hub.ensure(id);
      await hub.abort(s.id);
      return json(res, 200, { ok: true });
    }

    // POST /api/sessions/:id/model  { provider, id } | { cycle }
    id = sessionAction(pathname, "model");
    if (method === "POST" && id) {
      const body = await readJson(req);
      return json(res, 200, await hub.setModel(id, body));
    }

    // GET|POST /api/sessions/:id/scoped-models — Ctrl+P cycle allowlist (pi /scoped-models)
    id = sessionAction(pathname, "scoped-models");
    if (method === "GET" && id) {
      return json(res, 200, hub.getScopedModels(id));
    }
    if (method === "POST" && id) {
      const body = await readJson(req);
      return json(res, 200, hub.setScopedModels(id, body));
    }

    // POST /api/sessions/:id/share — secret GitHub gist (pi /share)
    id = sessionAction(pathname, "share");
    if (method === "POST" && id) {
      try {
        return json(res, 200, await hub.share(id));
      } catch (e) {
        return json(res, 400, {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // GET|POST /api/sessions/:id/trust — project trust (pi /trust)
    id = sessionAction(pathname, "trust");
    if (method === "GET" && id) {
      return json(res, 200, hub.getTrust(id));
    }
    if (method === "POST" && id) {
      try {
        const body = await readJson(req);
        return json(res, 200, hub.setTrust(id, body));
      } catch (e) {
        return json(res, 400, {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // GET|POST /api/sessions/:id/thinking
    id = sessionAction(pathname, "thinking");
    if (method === "GET" && id) {
      return json(res, 200, hub.getThinking(id));
    }
    if (method === "POST" && id) {
      const body = await readJson(req);
      return json(res, 200, hub.setThinking(id, body));
    }

    // POST /api/sessions/:id/compact  { instructions? }
    id = sessionAction(pathname, "compact");
    if (method === "POST" && id) {
      const body = await readJson(req);
      return json(res, 200, await hub.compact(id, body.instructions));
    }

    // GET /api/sessions/:id/tree — session entry tree for /tree
    // POST /api/sessions/:id/tree  { targetId, summarize?, customInstructions? }
    id = sessionAction(pathname, "tree");
    if (method === "GET" && id) {
      return json(res, 200, await hub.getTree(id));
    }
    if (method === "POST" && id) {
      const body = await readJson(req);
      if (!body.targetId || typeof body.targetId !== "string") {
        return json(res, 400, { error: "targetId required" });
      }
      return json(
        res,
        200,
        await hub.navigateTree(id, body.targetId, {
          summarize: body.summarize,
          customInstructions: body.customInstructions,
        }),
      );
    }

    // GET /api/sessions/:id/fork — user messages for /fork picker
    // POST /api/sessions/:id/fork  { entryId, position?: "before"|"at" }
    id = sessionAction(pathname, "fork");
    if (method === "GET" && id) {
      return json(res, 200, await hub.getForkCandidates(id));
    }
    if (method === "POST" && id) {
      const body = await readJson(req);
      if (!body.entryId || typeof body.entryId !== "string") {
        return json(res, 400, { error: "entryId required" });
      }
      const position = body.position === "at" ? "at" : "before";
      return json(res, 200, await hub.fork(id, body.entryId, { position }));
    }

    // POST /api/sessions/:id/steer  { message, images? }
    id = sessionAction(pathname, "steer");
    if (method === "POST" && id) {
      const body = await readJson(req);
      if (typeof body.message !== "string") {
        return json(res, 400, { error: "message required" });
      }
      if (!body.message.trim() && !hasImages(body.images)) {
        return json(res, 400, { error: "message required" });
      }
      const s = await hub.ensure(id);
      hub.steer(s.id, body.message, body.images).catch((err) => {
        console.error("[pi-gui] steer error", s.id, err);
      });
      return json(res, 202, { ok: true, id: s.id });
    }

    // POST /api/sessions/:id/follow-up  { message, images? }
    id = sessionAction(pathname, "follow-up");
    if (method === "POST" && id) {
      const body = await readJson(req);
      if (typeof body.message !== "string") {
        return json(res, 400, { error: "message required" });
      }
      if (!body.message.trim() && !hasImages(body.images)) {
        return json(res, 400, { error: "message required" });
      }
      const s = await hub.ensure(id);
      await hub.followUp(s.id, body.message, body.images);
      return json(res, 200, { ok: true, id: s.id });
    }

    // POST /api/sessions/:id/bash  { command, excludeFromContext? }
    id = sessionAction(pathname, "bash");
    if (method === "POST" && id) {
      const body = await readJson(req);
      if (!body.command || typeof body.command !== "string") {
        return json(res, 400, { error: "command required" });
      }
      const s = await hub.ensure(id);
      hub
        .bash(s.id, body.command, {
          excludeFromContext: Boolean(body.excludeFromContext),
        })
        .catch((err) => {
          console.error("[pi-gui] bash error", s.id, err);
        });
      return json(res, 202, { ok: true, id: s.id });
    }

    // POST /api/sessions/:id/abort-bash
    id = sessionAction(pathname, "abort-bash");
    if (method === "POST" && id) {
      hub.abortBash(id);
      return json(res, 200, { ok: true });
    }

    // GET|POST /api/sessions/:id/tools
    id = sessionAction(pathname, "tools");
    if (method === "GET" && id) {
      return json(res, 200, hub.getTools(id));
    }
    if (method === "POST" && id) {
      const body = await readJson(req);
      if (!Array.isArray(body.active)) {
        return json(res, 400, { error: "active: string[] required" });
      }
      return json(res, 200, hub.setTools(id, body.active));
    }

    // GET /api/sessions/:id/skills — skill workspace index
    // POST /api/sessions/:id/skills — create/import a user or project skill
    id = sessionAction(pathname, "skills");
    if (method === "GET" && id) {
      return json(res, 200, await hub.getSkills(id));
    }
    if (method === "POST" && id) {
      const body = await readJson(req);
      try {
        return json(res, 200, await hub.createSkill(id, body));
      } catch (e) {
        return json(res, 400, {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // GET|PATCH /api/sessions/:id/skill-file — read/save loaded SKILL.md
    id = sessionAction(pathname, "skill-file");
    if (method === "GET" && id) {
      const filePath = searchParams.get("path") || "";
      try {
        return json(res, 200, await hub.getSkillFile(id, filePath));
      } catch (e) {
        return json(res, 400, {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    if (method === "PATCH" && id) {
      const body = await readJson(req);
      try {
        return json(res, 200, await hub.saveSkill(id, body));
      } catch (e) {
        return json(res, 400, {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // GET /api/sessions/:id/extensions — list loaded extensions for /extensions palette
    id = sessionAction(pathname, "extensions");
    if (method === "GET" && id) {
      return json(res, 200, hub.getExtensions(id));
    }

    // GET /api/sessions/:id/commands — slash commands (extension + prompt + skill)
    id = sessionAction(pathname, "commands");
    if (method === "GET" && id) {
      return json(res, 200, await hub.getCommands(id));
    }

    // GET /api/sessions/:id/git — working tree status
    // GET /api/sessions/:id/git?path= — unified diff for one file
    id = sessionAction(pathname, "git");
    if (method === "GET" && id) {
      const s = await hub.ensure(id);
      const file = searchParams.get("path");
      try {
        if (file) return json(res, 200, await gitFileDiff(s.cwd, file));
        return json(res, 200, await gitStatus(s.cwd));
      } catch (e) {
        return json(res, 400, {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // GET /api/sessions/:id/events  — SSE (seq + resume protocol)
    // Cold/gap: connected{seq,ringStart} only → client REST snapshot
    // Resume: ring events with seq > after, then live
    id = sessionAction(pathname, "events");
    if (method === "GET" && id) {
      const s = await hub.ensure(id);
      const hubId = s.id;
      const afterSeq = lastEventIdFrom(req, searchParams);
      const { seq: headSeq, ringStart } = hub.ringInfo(hubId);
      const replay = shouldReplayRing(afterSeq, ringStart);
      // No socket idle kill on long-lived event streams
      req.socket?.setTimeout(0);
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "Access-Control-Allow-Origin": "*",
      });
      // No id: — must not advance browser Last-Event-ID past ring
      res.write(
        `data: ${JSON.stringify(
          connectedPayload({ id: hubId, seq: headSeq, ringStart }),
        )}\n\n`,
      );

      // Resume cursor; cold/gap starts at head so live-only after snapshot
      let lastWritten = replay ? afterSeq : headSeq;
      /** @type {{ event: unknown, seq: number }[]} */
      let pending = [];
      let replaying = true;

      /** @param {unknown} event @param {number} seq */
      const write = (event, seq) => {
        if (res.writableEnded) return;
        if (!(seq > lastWritten)) return;
        lastWritten = seq;
        try {
          res.write(formatSseEvent(event, seq));
        } catch {
          /* client gone */
        }
      };

      // Subscribe first so live events during snapshot/replay are not lost
      const unsub = hub.subscribe(hubId, (event, seq) => {
        if (replaying) pending.push({ event, seq });
        else write(event, seq);
      });

      if (replay) {
        for (const x of hub.eventsAfter(hubId, afterSeq)) {
          write(x.event, x.seq);
        }
      }
      replaying = false;
      const queued = pending;
      pending = [];
      for (const x of queued) write(x.event, x.seq);

      const beat = setInterval(() => {
        if (res.writableEnded) {
          clearInterval(beat);
          return;
        }
        try {
          res.write(`: ping\n\n`);
        } catch {
          clearInterval(beat);
          unsub();
        }
      }, 15000);

      req.on("close", () => {
        clearInterval(beat);
        unsub();
      });
      return;
    }

    // GET|PATCH|DELETE /api/sessions/:id
    const sessionMatch = pathname.match(/^\/api\/sessions\/([^/]+)$/);
    if (sessionMatch) {
      id = decodeURIComponent(sessionMatch[1]);
      if (method === "GET") {
        const s = await hub.ensure(id);
        return json(res, 200, hub.get(s.id));
      }
      if (method === "PATCH") {
        const body = await readJson(req);
        if (body.name != null) {
          if (typeof body.name !== "string") {
            return json(res, 400, { error: "name must be string" });
          }
          return json(res, 200, hub.setName(id, body.name));
        }
        return json(res, 200, hub.get(id));
      }
      if (method === "DELETE") {
        await hub.close(id);
        return json(res, 200, { ok: true });
      }
    }

    return json(res, 404, { error: "not found" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code =
      err && typeof err === "object" && "code" in err ? err.code : undefined;
    // Expected race: UI hit a disk id before open — quiet 404, no panel spam
    if (code === "SESSION_NOT_OPEN" || /^Session not open:/.test(message)) {
      return json(res, 404, { error: message, code: "SESSION_NOT_OPEN" });
    }
    console.error("[pi-gui]", message);
    return json(res, 500, { error: message });
  }
}

/**
 * Resolve a URL path to a real file under WEB_DIST, or a status.
 * Assets never SPA-fallback. Only regular files are returned.
 * @param {string} pathname
 * @returns {Promise<{ status: number; filePath?: string }>}
 */
async function resolveStatic(pathname) {
  const root = path.resolve(WEB_DIST);
  // Normalize URL path (posix-style) then map into dist
  let safe = path.posix.normalize(pathname || "/");
  if (!safe.startsWith("/")) safe = `/${safe}`;
  // Block path escape segments after normalize
  if (safe.split("/").includes("..")) return { status: 403 };

  const isAsset = safe === "/assets" || safe.startsWith("/assets/");
  const rel = safe === "/" ? "index.html" : safe.slice(1);
  let filePath = path.resolve(root, rel);

  // Containment: must stay under dist
  if (filePath !== root && !filePath.startsWith(root + path.sep)) {
    return { status: 403 };
  }

  /** @param {string} p */
  async function asFile(p) {
    const st = await stat(p);
    if (!st.isFile()) throw Object.assign(new Error("not a file"), { code: "ENOTFILE" });
    return p;
  }

  try {
    const st = await stat(filePath);
    if (st.isFile()) return { status: 200, filePath };
    if (st.isDirectory()) {
      // Never invent index.html under hashed asset trees
      if (isAsset) return { status: 404 };
      try {
        return { status: 200, filePath: await asFile(path.join(filePath, "index.html")) };
      } catch {
        return { status: 200, filePath: await asFile(path.join(root, "index.html")) };
      }
    }
    return { status: 404 };
  } catch {
    // Missing: SPA shell for app routes only
    if (isAsset || path.extname(safe)) return { status: 404 };
    try {
      return { status: 200, filePath: await asFile(path.join(root, "index.html")) };
    } catch {
      return { status: 404 };
    }
  }
}

/**
 * Stream a verified file. Headers only after open — no 200-then-fail races.
 * @param {http.ServerResponse} res
 * @param {string} filePath
 */
function sendFile(res, filePath) {
  const ext = path.extname(filePath);
  const type = MIME[ext] || "application/octet-stream";
  const stream = createReadStream(filePath);

  const fail = (err) => {
    if (err) console.error("[pi-gui] static", filePath, err.message || err);
    if (!res.headersSent) text(res, 404, "not found");
    else if (!res.writableEnded) res.end();
  };

  stream.on("error", fail);
  stream.on("open", () => {
    if (res.writableEnded) {
      stream.destroy();
      return;
    }
    if (!res.headersSent) {
      res.writeHead(200, { "Content-Type": type });
    }
    stream.pipe(res);
  });
  res.on("close", () => {
    if (!stream.destroyed) stream.destroy();
  });
}

/**
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
async function handleStatic(req, res) {
  if (WEB_DEV || !existsSync(WEB_DIST)) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<!doctype html>
<html><body style="font-family:system-ui;padding:2rem">
  <h1>pi-gui</h1>
  <p>Web UI not built. Run <code>npm run dev:web</code> (port 5173) or <code>npm run build</code>.</p>
  <p>API is up at <code>/api/health</code>.</p>
</body></html>`);
    return;
  }

  const { pathname } = parsePath(req.url || "/");
  const resolved = await resolveStatic(pathname);
  if (resolved.status === 403) return text(res, 403, "forbidden");
  if (resolved.status !== 200 || !resolved.filePath) {
    return text(res, 404, "not found");
  }
  sendFile(res, resolved.filePath);
}

/**
 * @param {{ port?: number; stayAlive?: boolean }} opts
 * stayAlive: in-process /gui — close server without process.exit
 */
export function createServer(opts = {}) {
  const port = opts.port ?? Number(process.env.PI_GUI_PORT || 3847);
  const stayAlive = Boolean(opts.stayAlive);
  hostCtl.stayAlive = stayAlive;

  const server = http.createServer((req, res) => {
    // Never let a handler kill the process
    Promise.resolve()
      .then(async () => {
        if ((req.url || "").startsWith("/api")) {
          await handleApi(req, res);
        } else {
          await handleStatic(req, res);
        }
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[pi-gui] request error", message);
        json(res, 500, { error: message });
      });
  });

  // Node default requestTimeout is 300_000 (5 min) — kills long-lived SSE.
  // Localhost GUI only; disable so /events stays open.
  server.requestTimeout = 0;
  server.headersTimeout = 0;

  server.on("error", (err) => {
    console.error("[pi-gui] server error", err.message);
  });

  const api = {
    server,
    port,
    stayAlive,
    /** @param {() => void} [cb] */
    listen(cb) {
      server.listen(port, "127.0.0.1", () => {
        console.log(`[pi-gui] http://127.0.0.1:${port}`);
        cb?.();
      });
      return server;
    },
    close() {
      hub.disposeAll();
      return new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve(undefined)));
      });
    },
  };
  hostCtl.close = () => api.close();
  return api;
}
