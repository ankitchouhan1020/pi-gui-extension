/**
 * Session hub — multi-session AgentSession manager for the web UI.
 * One process, many open sessions; SSE fans out events per session.
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import {
  createAgentSession,
  getAgentDir,
  ModelRegistry,
  ModelRuntime,
  parseSessionEntries,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

/**
 * Mirror of pi's getDefaultSessionDir (not re-exported from package index).
 * ~/.pi/agent/sessions/--encoded-cwd--/
 * @param {string} cwd
 */
function defaultSessionDir(cwd) {
  const resolvedCwd = resolve(cwd);
  const safePath = `--${resolvedCwd.replace(/^[/\\]/, "").replace(/[/\\:]/g, "-")}--`;
  return join(getAgentDir(), "sessions", safePath);
}

/** Sync ModelRegistry facade over session.modelRuntime (AuthStorage removed in SDK). */
function modelRegistry(session) {
  return new ModelRegistry(session.modelRuntime);
}

/** @typedef {import("@earendil-works/pi-coding-agent").AgentSession} AgentSession */
/** @typedef {import("@earendil-works/pi-coding-agent").SessionInfo} SessionInfo */

/**
 * @typedef {object} OpenSession
 * @property {string} id
 * @property {string} [path]
 * @property {string} cwd
 * @property {AgentSession} session
 * @property {() => void} unsub
 * @property {Set<(ev: unknown, seq: number) => void>} listeners
 * @property {number} sseSeq
 * @property {{ seq: number, event: unknown }[]} sseRing
 * @property {ReturnType<typeof setTimeout> | null} [idleTimer]
 */

/** Idle-close when no SSE listeners (0 = disabled). */
const SESSION_IDLE_MS = Number(process.env.PI_GUI_SESSION_IDLE_MS ?? 10 * 60 * 1000);

/** Recent SSE events for Last-Event-ID replay after reconnect. */
const SSE_RING_MAX = 500;

/** Preview text for a session tree entry (for /tree UI). */
function entryPreview(entry) {
  if (!entry) return "";
  switch (entry.type) {
    case "message": {
      const msg = entry.message;
      if (!msg) return "message";
      if (msg.role === "bashExecution" && msg.command) {
        return `! ${String(msg.command).slice(0, 120)}`;
      }
      const c = msg.content;
      let text = "";
      if (typeof c === "string") text = c;
      else if (Array.isArray(c)) {
        text = c
          .map((p) =>
            typeof p === "string"
              ? p
              : p && typeof p === "object" && typeof p.text === "string"
                ? p.text
                : p && typeof p === "object" && p.type === "toolCall"
                  ? `[tool:${p.name || "?"}]`
                  : "",
          )
          .filter(Boolean)
          .join(" ");
      }
      text = text.replace(/\s+/g, " ").trim();
      return text.slice(0, 120) || msg.role || "message";
    }
    case "compaction":
      return "compaction";
    case "branch_summary":
      return String(entry.summary || "branch summary").slice(0, 120);
    case "model_change":
      return `model ${entry.modelId || ""}`.trim();
    case "thinking_level_change":
      return `thinking ${entry.thinkingLevel || ""}`.trim();
    case "session_info":
      return entry.name ? `title ${entry.name}` : "title";
    case "custom_message":
      return String(entry.customType || "custom").slice(0, 120);
    case "custom":
      return String(entry.customType || "custom").slice(0, 120);
    case "label":
      return entry.label ? `label ${entry.label}` : "label";
    default:
      return entry.type || "entry";
  }
}

/** @param {import("@earendil-works/pi-coding-agent").SessionTreeNode[]} nodes */
function slimTree(nodes) {
  return (nodes || []).map((n) => {
    const entry = n.entry;
    return {
      id: entry.id,
      type: entry.type,
      role:
        entry.type === "message" && entry.message
          ? entry.message.role
          : undefined,
      preview: entryPreview(entry),
      label: n.label,
      children: slimTree(n.children),
    };
  });
}

export class SessionHub {
  constructor() {
    /** @type {Map<string, OpenSession>} */
    this.sessions = new Map();
    /** @type {import("@earendil-works/pi-coding-agent").ModelRegistry | null} */
    this._warmReg = null;
    /** @type {AgentSession | null} keep alive so extension providers stay registered */
    this._warmSession = null;
    /** @type {Promise<void>} */
    this._warmPromise = this.#warmRegistry();
    /**
     * Short mutex for #activate only (session_start handlers may touch
     * process-global extension scope). Must NOT wrap long agent.prompt awaits.
     * @type {Promise<unknown>}
     */
    this._activateTail = Promise.resolve();
    /** Per-session turn queue (prompt/steer/bash/compact on same hub id). */
    /** @type {Map<string, Promise<unknown>>} */
    this._sessionTurnTails = new Map();
    /** Serialize open/close per session file path. */
    /** @type {Map<string, Promise<unknown>>} */
    this._pathLocks = new Map();
  }

  /**
   * Promise chain lock (path or session-turn queues).
   * @template T
   * @param {Map<string, Promise<unknown>>} map
   * @param {string} key
   * @param {() => Promise<T>} fn
   * @returns {Promise<T>}
   */
  async #withKeyed(map, key, fn) {
    const k = key || "__none__";
    const prev = map.get(k) ?? Promise.resolve();
    /** @type {() => void} */
    let unlock = () => {};
    const gate = new Promise((r) => {
      unlock = r;
    });
    map.set(
      k,
      prev.then(() => gate).catch(() => gate),
    );
    await prev.catch(() => {});
    try {
      return await fn();
    } finally {
      unlock();
    }
  }

  /**
   * Run fn exclusively for path (open/close races).
   * @template T
   * @param {string} key
   * @param {() => Promise<T>} fn
   * @returns {Promise<T>}
   */
  async #withPath(key, fn) {
    return this.#withKeyed(this._pathLocks, key, fn);
  }

  /**
   * Serialize ops on one session (same chat must not double-prompt).
   * Different sessions run turns in parallel.
   * @template T
   * @param {string} sessionId
   * @param {() => Promise<T>} fn
   * @returns {Promise<T>}
   */
  async #withSessionTurn(sessionId, fn) {
    return this.#withKeyed(this._sessionTurnTails, sessionId, fn);
  }

  /**
   * Exclusive only while rebinding process-global extension scope.
   * @template T
   * @param {() => Promise<T>} fn
   * @returns {Promise<T>}
   */
  async #withActivate(fn) {
    const prev = this._activateTail;
    /** @type {() => void} */
    let unlock = () => {};
    this._activateTail = new Promise((r) => {
      unlock = r;
    });
    await prev.catch(() => {});
    try {
      return await fn();
    } finally {
      unlock();
    }
  }

  /**
   * Per-session turn + short activate, then long agent op concurrent across sessions.
   * @template T
   * @param {string} id hub id / path / disk id
   * @param {(s: OpenSession) => Promise<T>} fn
   * @returns {Promise<T>}
   */
  async #runTurn(id, fn) {
    const s0 = this.require(id);
    return this.#withSessionTurn(s0.id, async () => {
      const s = this.require(s0.id);
      await this.#withActivate(() => this.#activate(s));
      return await fn(s);
    });
  }

  /**
   * Resolve hub session by hub id, path, or disk id (auto-open from disk).
   * @param {string} ref
   * @returns {Promise<OpenSession>}
   */
  async ensure(ref) {
    if (!ref) {
      const err = new Error("Session not open: ");
      // @ts-expect-error
      err.code = "SESSION_NOT_OPEN";
      throw err;
    }
    const hit = this.#findOpen(ref);
    if (hit) return hit;

    const disk = await this.listDisk();
    const info = disk.find((i) => i.id === ref || i.path === ref);
    if (!info?.path) {
      const err = new Error(`Session not open: ${ref}`);
      // @ts-expect-error
      err.code = "SESSION_NOT_OPEN";
      throw err;
    }
    // Re-check after await (parallel open)
    const again = this.#findOpen(info.path) || this.#findOpen(info.id);
    if (again) return again;

    await this.open({ path: info.path, cwd: info.cwd });
    const opened = this.#findOpen(info.path) || this.#findOpen(info.id);
    if (opened) return opened;

    const err = new Error(`Session not open: ${ref}`);
    // @ts-expect-error
    err.code = "SESSION_NOT_OPEN";
    throw err;
  }

  /** @param {string} ref */
  #findOpen(ref) {
    const byId = this.sessions.get(ref);
    if (byId) return byId;
    for (const s of this.sessions.values()) {
      if (s.path === ref || s.id === ref) return s;
    }
    return null;
  }

  /**
   * Fail a turn: SSE error + settled so UI never sticks on streaming.
   * @param {OpenSession} s
   * @param {unknown} err
   */
  #failTurn(s, err) {
    const message = err instanceof Error ? err.message : String(err);
    this.#emit(s, { type: "error", error: message });
    this.#emit(s, { type: "agent_settled" });
  }

  /** @param {OpenSession} s */
  #cancelIdle(s) {
    if (s.idleTimer) {
      clearTimeout(s.idleTimer);
      s.idleTimer = null;
    }
  }

  /** Close when no SSE clients and idle (not streaming). */
  #scheduleIdle(s) {
    this.#cancelIdle(s);
    if (!(SESSION_IDLE_MS > 0)) return;
    if (s.listeners.size > 0) return;
    s.idleTimer = setTimeout(() => {
      s.idleTimer = null;
      const cur = this.sessions.get(s.id);
      if (!cur || cur.listeners.size > 0) return;
      if (cur.session.isStreaming || cur.session.isBashRunning) {
        this.#scheduleIdle(cur);
        return;
      }
      this.close(cur.id).catch((e) => {
        console.error(
          "[pi-gui] idle close failed",
          e instanceof Error ? e.message : e,
        );
      });
    }, SESSION_IDLE_MS);
  }

  /**
   * Load packages/extensions once so custom providers (e.g. grok-sdk / grok-agent-cli)
   * appear in GET /api/models even with no open chat session.
   */
  async #warmRegistry() {
    try {
      const { session } = await createAgentSession({
        cwd: process.cwd(),
        sessionManager: SessionManager.inMemory(process.cwd()),
      });
      this._warmSession = session;
      this._warmReg = modelRegistry(session);
    } catch (err) {
      console.error(
        "[pi-gui] model registry warm failed",
        err instanceof Error ? err.message : err,
      );
    }
  }

  /** @returns {Promise<import("@earendil-works/pi-coding-agent").ModelRegistry | null>} */
  async #registry() {
    if (this._warmReg) return this._warmReg;
    await this._warmPromise;
    return this._warmReg;
  }

  /** @param {string} [cwd] */
  async listDisk(cwd) {
    if (cwd) return SessionManager.list(cwd);
    return SessionManager.listAll();
  }

  listOpen() {
    return [...this.sessions.values()].map((s) => this.#meta(s));
  }

  /**
   * Merge disk sessions with open state.
   * @param {string} [cwd]
   */
  async list(cwd) {
    const disk = await this.listDisk(cwd);
    const openByPath = new Map(
      [...this.sessions.values()]
        .filter((s) => s.path)
        .map((s) => [s.path, s]),
    );
    const openById = new Map([...this.sessions.values()].map((s) => [s.id, s]));

    /** @type {Array<Record<string, unknown>>} */
    const rows = disk.map((info) => {
      const running = openByPath.get(info.path) ?? openById.get(info.id);
      return {
        // Prefer live hub id — disk id can differ and breaks /api/sessions/:id
        id: running?.id ?? info.id,
        path: running?.path ?? info.path,
        cwd: running?.cwd ?? info.cwd,
        name: info.name,
        created: info.created,
        modified: info.modified,
        messageCount: info.messageCount,
        firstMessage: info.firstMessage,
        running: Boolean(running),
        streaming: running?.session.isStreaming ?? false,
        model: running
          ? {
              provider: running.session.model?.provider,
              id: running.session.model?.id,
              name: running.session.model?.name,
            }
          : undefined,
      };
    });

    // In-memory / newly created sessions not yet on disk list
    for (const s of this.sessions.values()) {
      if (!rows.some((r) => r.id === s.id || (s.path && r.path === s.path))) {
        rows.unshift({
          id: s.id,
          path: s.path,
          cwd: s.cwd,
          name: s.session.sessionName,
          messageCount: s.session.messages.length,
          firstMessage: "",
          running: true,
          streaming: s.session.isStreaming,
          model: {
            provider: s.session.model?.provider,
            id: s.session.model?.id,
            name: s.session.model?.name,
          },
        });
      }
    }

    // Modified-desc only — don't jump open sessions to the top
    rows.sort((a, b) => {
      const am = a.modified ? new Date(/** @type {Date} */ (a.modified)).getTime() : 0;
      const bm = b.modified ? new Date(/** @type {Date} */ (b.modified)).getTime() : 0;
      return bm - am;
    });
    return rows;
  }

  /**
   * @param {{ path?: string; cwd?: string; fresh?: boolean; content?: string; filename?: string }} opts
   */
  async open(opts = {}) {
    if (opts.content != null) {
      return this.importContent(opts.content, {
        cwd: opts.cwd,
        filename: opts.filename,
      });
    }
    const cwd = opts.cwd || process.cwd();
    if (opts.path) {
      return this.#withPath(opts.path, async () => {
        const existing = this.#findOpen(opts.path);
        if (existing) return this.#meta(existing);
        const sessionManager = SessionManager.open(opts.path, undefined, cwd);
        const { session, modelFallbackMessage } = await createAgentSession({
          cwd,
          sessionManager,
        });
        return this.#mountSession(session, cwd, modelFallbackMessage);
      });
    }
    const sessionManager = SessionManager.create(cwd);
    const { session, modelFallbackMessage } = await createAgentSession({
      cwd,
      sessionManager,
    });
    return this.#mountSession(session, cwd, modelFallbackMessage);
  }

  /**
   * Bind, restore model, subscribe, register open session.
   * @param {AgentSession} session
   * @param {string} cwd
   * @param {string} [modelFallbackMessage]
   */
  async #mountSession(session, cwd, modelFallbackMessage) {
    // Fire session_start so extensions (e.g. pi-grok-sdk) bind to this session's cwd.
    // Without this, Grok ACP falls back to process.cwd() (the hub's launch dir).
    await this.#bindSession(session);

    // SDK restores model before extension providers land in ModelRegistry.
    // Re-apply saved model once providers are registered (bindCore flushes them).
    const restoredFallback = await this.#restoreSessionModel(
      session,
      session.sessionManager,
      modelFallbackMessage,
    );

    const id = session.sessionId;
    /** @type {OpenSession} */
    const entry = {
      id,
      path: session.sessionFile,
      cwd,
      session,
      unsub: () => {},
      listeners: new Set(),
      sseSeq: 0,
      sseRing: [],
    };
    entry.unsub = session.subscribe((event) => this.#fanout(entry, event));
    this.sessions.set(id, entry);

    return {
      ...this.#meta(entry),
      modelFallbackMessage: restoredFallback,
    };
  }

  /**
   * Re-apply model from session JSONL after providers are registered.
   * createAgentSession restores before bindCore flushes pending providers
   * (extension models like grok-agent-cli), so resume often falls back.
   * @param {AgentSession} session
   * @param {SessionManager} sessionManager
   * @param {string} [fallbackMsg]
   */
  async #restoreSessionModel(session, sessionManager, fallbackMsg) {
    const saved = sessionManager.buildSessionContext()?.model;
    if (!saved?.provider || !saved?.modelId) return fallbackMsg;
    const cur = session.model;
    if (cur?.provider === saved.provider && cur?.id === saved.modelId) {
      return fallbackMsg;
    }
    const model = modelRegistry(session).find(saved.provider, saved.modelId);
    if (!model) return fallbackMsg;
    try {
      await session.setModel(model);
      return undefined;
    } catch {
      return fallbackMsg;
    }
  }

  /**
   * Bind extension lifecycle (session_start). Required for cwd-aware providers.
   * @param {AgentSession} session
   */
  async #bindSession(session) {
    await session.bindExtensions({
      mode: "rpc",
      onError: (err) => {
        console.error(
          `[pi-gui] extension error (${err.extensionPath}):`,
          err.error instanceof Error ? err.error.message : err.error,
        );
      },
    });
  }

  /**
   * Re-emit session_start on this session's runner so process-global extension
   * state (e.g. pi-grok-sdk cwd/scope) matches the session about to run a turn.
   * Safe to call repeatedly; does not re-load extensions.
   * @param {OpenSession} s
   */
  async #activate(s) {
    const runner = s.session.extensionRunner;
    if (!runner?.hasHandlers?.("session_start")) return;
    try {
      await runner.emit({ type: "session_start", reason: "resume" });
    } catch (err) {
      console.error(
        "[pi-gui] session activate failed",
        err instanceof Error ? err.message : err,
      );
    }
  }

  /**
   * Import a pi session JSONL from browser upload (no filesystem path available).
   * Writes under the session dir, then opens via SessionManager.open.
   * @param {string} content
   * @param {{ cwd?: string; filename?: string }} [opts]
   */
  async importContent(content, opts = {}) {
    const text = String(content ?? "").trim();
    if (!text) throw new Error("Empty session file");

    const entries = parseSessionEntries(text);
    const header = entries.find((e) => e && e.type === "session");
    if (!header) {
      throw new Error("Not a pi session JSONL (missing session header line)");
    }

    const cwd =
      opts.cwd ||
      (typeof header.cwd === "string" && header.cwd ? header.cwd : process.cwd());
    const dir = defaultSessionDir(cwd);
    mkdirSync(dir, { recursive: true });

    const rawName = (opts.filename || "").replace(/^.*[/\\]/, "");
    const safe =
      rawName.replace(/[^\w.-]+/g, "_").replace(/^\.+/, "") ||
      `import-${typeof header.id === "string" ? header.id.slice(0, 12) : randomBytes(4).toString("hex")}.jsonl`;
    const base = safe.endsWith(".jsonl") ? safe : `${safe}.jsonl`;
    let dest = join(dir, base);
    if (existsSync(dest)) {
      dest = join(
        dir,
        base.replace(/\.jsonl$/i, "") + `-${Date.now()}.jsonl`,
      );
    }

    writeFileSync(dest, text.endsWith("\n") ? text : `${text}\n`, "utf8");
    return this.open({ path: dest, cwd });
  }

  /**
   * @param {string} id
   * @param {(ev: unknown, seq: number) => void} listener
   */
  subscribe(id, listener) {
    const s = this.require(id);
    this.#cancelIdle(s);
    s.listeners.add(listener);
    return () => {
      s.listeners.delete(listener);
      this.#scheduleIdle(s);
    };
  }

  /**
   * Events with seq > afterSeq (for SSE Last-Event-ID replay).
   * @param {string} id
   * @param {number|string|undefined|null} afterSeq
   */
  eventsAfter(id, afterSeq) {
    const s = this.require(id);
    const n = Number(afterSeq);
    if (!Number.isFinite(n) || n < 0) return [];
    return s.sseRing.filter((x) => x.seq > n);
  }

  /**
   * SSE high-water + oldest ring seq (for resume / gap detection).
   * @param {string} id
   */
  ringInfo(id) {
    const s = this.require(id);
    const seq = s.sseSeq;
    const ringStart =
      s.sseRing.length > 0 ? s.sseRing[0].seq : seq > 0 ? seq + 1 : 1;
    return { seq, ringStart };
  }

  /** @param {string} id */
  get(id) {
    return this.#meta(this.require(id));
  }

  /** @param {string} id */
  getMessages(id) {
    const s = this.require(id);
    const msgs = s.session.messages;
    // Partial assistant is only on agent.state until message_end — include so REST
    // catch-up / reconnect can paint mid-turn (SSE is still the live path).
    const live = s.session.agent?.state?.streamingMessage;
    if (live && s.session.isStreaming) return [...msgs, live];
    return msgs;
  }

  /**
   * Assign seq, buffer, fan out to SSE listeners.
   * @param {OpenSession} s
   * @param {unknown} event
   */
  #fanout(s, event) {
    const seq = ++s.sseSeq;
    s.sseRing.push({ seq, event });
    if (s.sseRing.length > SSE_RING_MAX) s.sseRing.shift();
    for (const l of s.listeners) {
      try {
        l(event, seq);
      } catch {
        /* ignore listener errors */
      }
    }
  }

  /**
   * @param {OpenSession} s
   * @param {unknown} event
   */
  #emit(s, event) {
    this.#fanout(s, event);
  }

  /**
   * @param {string} id
   * @param {string} text
   * @param {{ type: "image"; data: string; mimeType: string }[]} [images]
   */
  async prompt(id, text, images) {
    return this.#runTurn(id, async (s) => {
      const imgs = normalizeImages(images);
      try {
        // pi rejects concurrent prompt(); steer if a turn is already running
        if (s.session.isStreaming) await s.session.steer(text, imgs);
        else if (imgs) await s.session.prompt(text, { images: imgs });
        else await s.session.prompt(text);
      } catch (err) {
        this.#failTurn(s, err);
        throw err;
      }
    });
  }

  /** @param {string} id */
  async abort(id) {
    const s = this.require(id);
    await s.session.abort();
  }

  /**
   * @param {string} id
   * @param {string} name
   */
  setName(id, name) {
    const s = this.require(id);
    s.session.setSessionName(name);
    return this.#meta(s);
  }

  /**
   * List models from a session's modelRegistry, or the package-warmed registry.
   * Bare ModelRuntime.create() omits extension providers (grok-sdk, cursor, …).
   * @param {string} [sessionId]
   */
  async listModels(sessionId) {
    /** @type {{ getAvailable: () => any[]; getAll: () => any[] } | null | undefined} */
    let reg;
    if (sessionId && this.sessions.has(sessionId)) {
      reg = modelRegistry(this.sessions.get(sessionId).session);
    } else {
      const open = this.sessions.values().next().value;
      reg = open ? modelRegistry(open.session) : await this.#registry();
    }
    if (!reg) {
      reg = new ModelRegistry(await ModelRuntime.create());
    }
    const available = reg.getAvailable();
    // Prefer available; if empty fall back to all. Always merge in providers that
    // are configured but might be missing from a stale "available-only" set.
    const models = available.length ? available : reg.getAll();
    return models.map((m) => ({
      provider: m.provider,
      id: m.id,
      name: m.name,
      reasoning: m.reasoning,
      contextWindow: m.contextWindow,
      maxTokens: m.maxTokens,
    }));
  }

  /**
   * @param {string} id
   * @param {{ provider?: string; id?: string; cycle?: "forward"|"backward" }} body
   */
  async setModel(id, body) {
    return this.#runTurn(id, async (s) => {
      if (body.cycle === "forward" || body.cycle === "backward") {
        const result = await s.session.cycleModel(body.cycle);
        return {
          ...this.#meta(s),
          cycled: result
            ? {
                provider: result.model.provider,
                id: result.model.id,
                name: result.model.name,
                thinkingLevel: result.thinkingLevel,
                isScoped: result.isScoped,
              }
            : null,
        };
      }
      if (!body.provider || !body.id) {
        throw new Error("provider+id or cycle required");
      }
      const model = modelRegistry(s.session).find(body.provider, body.id);
      if (!model) throw new Error(`Model not found: ${body.provider}/${body.id}`);
      await s.session.setModel(model);
      return this.#meta(s);
    });
  }

  /** @param {string} id */
  getThinking(id) {
    const s = this.require(id);
    return {
      level: s.session.thinkingLevel,
      available: s.session.getAvailableThinkingLevels(),
      supports: s.session.supportsThinking(),
    };
  }

  /**
   * @param {string} id
   * @param {{ level?: string; cycle?: boolean }} body
   */
  setThinking(id, body) {
    const s = this.require(id);
    if (body.cycle) {
      s.session.cycleThinkingLevel();
      return this.getThinking(id);
    }
    if (body.level == null) throw new Error("level or cycle required");
    s.session.setThinkingLevel(/** @type {any} */ (body.level));
    return this.getThinking(id);
  }

  /**
   * @param {string} id
   * @param {string} [instructions]
   */
  async compact(id, instructions) {
    return this.#runTurn(id, async (s) => {
      const result = await s.session.compact(instructions);
      return { ok: true, result, ...this.#meta(s) };
    });
  }

  /**
   * Session entry tree for /tree navigation (slim nodes for the web UI).
   * @param {string} id
   */
  getTree(id) {
    const s = this.require(id);
    const sm = s.session.sessionManager;
    return {
      tree: slimTree(sm.getTree()),
      leafId: sm.getLeafId(),
    };
  }

  /**
   * User messages for pi `/fork` selector.
   * @param {string} id
   */
  getForkCandidates(id) {
    const s = this.require(id);
    return {
      messages: s.session.getUserMessagesForForking().map((m) => ({
        entryId: m.entryId,
        text: m.text,
      })),
    };
  }

  /**
   * Fork into a new session file (pi `/fork` / `/clone`). Keeps the source open.
   * position "before" (default): path ends at parent of user message; selectedText for editor.
   * position "at": path includes entry (clone uses leaf + "at").
   * @param {string} id
   * @param {string} entryId
   * @param {{ position?: "before" | "at" }} [opts]
   */
  async fork(id, entryId, opts = {}) {
    const s = this.require(id);
    const sourceSm = s.session.sessionManager;
    const sessionFile = s.path || sourceSm.getSessionFile();
    if (!sessionFile || !existsSync(sessionFile)) {
      throw new Error("Session not saved yet — need a completed turn before forking");
    }

    const position = opts.position === "at" ? "at" : "before";
    const selectedEntry = sourceSm.getEntry(entryId);
    if (!selectedEntry) throw new Error("Invalid entry ID for forking");

    /** @type {string | null | undefined} */
    let targetLeafId;
    /** @type {string | undefined} */
    let selectedText;

    if (position === "at") {
      targetLeafId = selectedEntry.id;
    } else {
      if (selectedEntry.type !== "message" || selectedEntry.message?.role !== "user") {
        throw new Error("Invalid entry ID for forking");
      }
      targetLeafId = selectedEntry.parentId;
      const hit = s.session
        .getUserMessagesForForking()
        .find((m) => m.entryId === entryId);
      selectedText = hit?.text;
    }

    const sessionDir = sourceSm.getSessionDir();
    const cwd = s.cwd;

    /** @type {SessionManager} */
    let forkedSm;
    if (!targetLeafId) {
      forkedSm = SessionManager.create(cwd, sessionDir);
      forkedSm.newSession({ parentSession: sessionFile });
    } else {
      // Separate manager so createBranchedSession does not mutate the open session.
      forkedSm = SessionManager.open(sessionFile, sessionDir, cwd);
      const forkedPath = forkedSm.createBranchedSession(targetLeafId);
      if (!forkedPath) throw new Error("Failed to create forked session");
    }

    const { session, modelFallbackMessage } = await createAgentSession({
      cwd,
      sessionManager: forkedSm,
    });
    const meta = await this.#mountSession(session, cwd, modelFallbackMessage);
    return { ...meta, selectedText };
  }

  /**
   * Navigate to an entry (pi `/tree`). summarize defaults false (no branch summary prompt).
   * @param {string} id
   * @param {string} targetId
   * @param {{ summarize?: boolean; customInstructions?: string }} [opts]
   */
  async navigateTree(id, targetId, opts = {}) {
    const s = this.require(id);
    const sm = s.session.sessionManager;
    const leafId = sm.getLeafId();
    if (targetId === leafId) {
      return { ok: true, alreadyThere: true, leafId, editorText: undefined, cancelled: false };
    }
    const result = await s.session.navigateTree(targetId, {
      summarize: Boolean(opts.summarize),
      customInstructions: opts.customInstructions,
    });
    const newLeaf = sm.getLeafId();
    const payload = {
      type: "tree_navigated",
      leafId: newLeaf,
      editorText: result.editorText,
      cancelled: result.cancelled,
      aborted: result.aborted,
    };
    for (const l of s.listeners) {
      try {
        l(payload);
      } catch {
        /* ignore */
      }
    }
    return {
      ok: true,
      ...result,
      leafId: newLeaf,
      ...this.#meta(s),
    };
  }

  /**
   * Steer if streaming, else prompt.
   * @param {string} id
   * @param {string} message
   * @param {{ type: "image"; data: string; mimeType: string }[]} [images]
   */
  async steer(id, message, images) {
    return this.#runTurn(id, async (s) => {
      const imgs = normalizeImages(images);
      try {
        if (s.session.isStreaming) await s.session.steer(message, imgs);
        else if (imgs) await s.session.prompt(message, { images: imgs });
        else await s.session.prompt(message);
      } catch (err) {
        this.#failTurn(s, err);
        throw err;
      }
    });
  }

  /**
   * @param {string} id
   * @param {string} message
   * @param {{ type: "image"; data: string; mimeType: string }[]} [images]
   */
  async followUp(id, message, images) {
    return this.#runTurn(id, async (s) => {
      const imgs = normalizeImages(images);
      try {
        await s.session.followUp(message, imgs);
      } catch (err) {
        this.#failTurn(s, err);
        throw err;
      }
    });
  }

  /**
   * Run bash; stream chunks to SSE listeners as bash_chunk / bash_end.
   * @param {string} id
   * @param {string} command
   * @param {{ excludeFromContext?: boolean }} [opts]
   */
  async bash(id, command, opts = {}) {
    return this.#runTurn(id, async (s) => {
      const emit = (ev) => this.#emit(s, ev);
      emit({
        type: "bash_start",
        command,
        excludeFromContext: Boolean(opts.excludeFromContext),
      });
      try {
        const result = await s.session.executeBash(
          command,
          (chunk) => {
            emit({ type: "bash_chunk", command, chunk });
          },
          { excludeFromContext: Boolean(opts.excludeFromContext) },
        );
        const summary = {
          output: result.output,
          exitCode: result.exitCode,
          cancelled: result.cancelled,
          truncated: result.truncated,
        };
        emit({ type: "bash_end", command, result: summary });
        return summary;
      } catch (err) {
        emit({
          type: "bash_end",
          command,
          result: {
            output: err instanceof Error ? err.message : String(err),
            exitCode: 1,
            cancelled: false,
            truncated: false,
          },
        });
        throw err;
      }
    });
  }

  /** @param {string} id */
  abortBash(id) {
    this.require(id).session.abortBash();
  }

  /** @param {string} id */
  getTools(id) {
    const s = this.require(id);
    return {
      tools: s.session.getAllTools().map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
        sourceInfo: t.sourceInfo,
      })),
      active: s.session.getActiveToolNames(),
    };
  }

  /**
   * Skills loaded for this session (pi `/skill:name`).
   * @param {string} id
   */
  getSkills(id) {
    const s = this.require(id);
    const loaded = s.session.resourceLoader.getSkills();
    return {
      skills: (loaded.skills ?? []).map((sk) => ({
        name: sk.name,
        description: sk.description || "",
        filePath: sk.filePath,
        disableModelInvocation: Boolean(sk.disableModelInvocation),
        source: sk.sourceInfo?.source,
        scope: sk.sourceInfo?.scope,
      })),
    };
  }

  /**
   * Extensions loaded for this session (palette `/extensions`).
   * @param {string} id
   */
  getExtensions(id) {
    const s = this.require(id);
    const loaded = s.session.resourceLoader.getExtensions();
    return {
      extensions: (loaded.extensions ?? []).map((e) => ({
        path: e.path,
        resolvedPath: e.resolvedPath,
        source: e.sourceInfo?.source,
        scope: e.sourceInfo?.scope,
        origin: e.sourceInfo?.origin,
        commands: [...(e.commands?.keys() ?? [])],
        tools: [...(e.tools?.keys() ?? [])],
      })),
      errors: loaded.errors ?? [],
    };
  }

  /**
   * @param {string} id
   * @param {string[]} active
   */
  setTools(id, active) {
    const s = this.require(id);
    s.session.setActiveToolsByName(active);
    return this.getTools(id);
  }

  /** @param {string} id */
  async close(id) {
    const s = this.#findOpen(id);
    if (!s) return false;
    const key = s.path || s.id;
    return this.#withPath(key, async () => {
      const cur = this.sessions.get(s.id);
      if (!cur) return false;
      this.#cancelIdle(cur);
      cur.unsub();
      try {
        // Session-turn + short activate: process-global scope matches this
        // session so shutdown handlers dispose only this scope.
        await this.#withSessionTurn(cur.id, async () => {
          await this.#withActivate(async () => {
            await this.#activate(cur);
            const runner = cur.session.extensionRunner;
            if (runner?.hasHandlers?.("session_shutdown")) {
              await runner.emit({ type: "session_shutdown", reason: "quit" });
            }
          });
        });
      } catch (err) {
        console.error(
          "[pi-gui] session_shutdown failed",
          err instanceof Error ? err.message : err,
        );
      }
      cur.session.dispose();
      this.sessions.delete(cur.id);
      this._sessionTurnTails.delete(cur.id);
      return true;
    });
  }

  async disposeAll() {
    for (const id of [...this.sessions.keys()]) await this.close(id);
    if (this._warmSession) {
      try {
        this._warmSession.dispose();
      } catch {
        /* ignore */
      }
      this._warmSession = null;
      this._warmReg = null;
    }
  }

  /** @param {string} id */
  require(id) {
    const s = this.#findOpen(id);
    if (!s) {
      const err = new Error(`Session not open: ${id}`);
      // @ts-expect-error
      err.code = "SESSION_NOT_OPEN";
      throw err;
    }
    return s;
  }

  /** @param {OpenSession} s */
  #meta(s) {
    const sess = s.session;
    return {
      id: s.id,
      path: s.path,
      cwd: s.cwd,
      running: true,
      streaming: sess.isStreaming,
      messageCount: sess.messages.length,
      name: sess.sessionName,
      sessionName: sess.sessionName,
      thinkingLevel: sess.thinkingLevel,
      stats: sess.getSessionStats(),
      contextUsage: sess.getContextUsage(),
      activeTools: sess.getActiveToolNames(),
      isCompacting: sess.isCompacting,
      isBashRunning: sess.isBashRunning,
      pendingMessageCount: sess.pendingMessageCount,
      model: {
        provider: sess.model?.provider,
        id: sess.model?.id,
        name: sess.model?.name,
      },
    };
  }
}

/**
 * Coerce client image payloads to pi ImageContent[].
 * Accepts raw base64 or data-URL `data`; drops invalid entries.
 * @param {unknown} images
 * @returns {{ type: "image"; data: string; mimeType: string }[] | undefined}
 */
function normalizeImages(images) {
  if (!Array.isArray(images) || images.length === 0) return undefined;
  /** @type {{ type: "image"; data: string; mimeType: string }[]} */
  const out = [];
  for (const img of images) {
    if (!img || typeof img !== "object") continue;
    const raw = /** @type {{ data?: unknown; mimeType?: unknown; type?: unknown }} */ (
      img
    );
    let data = typeof raw.data === "string" ? raw.data : "";
    let mimeType = typeof raw.mimeType === "string" ? raw.mimeType : "";
    if (data.startsWith("data:") && data.includes(",")) {
      const header = data.slice(5, data.indexOf(","));
      const m = /^([^;]+)/.exec(header);
      if (!mimeType && m) mimeType = m[1];
      data = data.slice(data.indexOf(",") + 1);
    }
    if (!data || !mimeType) continue;
    out.push({ type: "image", data, mimeType });
  }
  return out.length ? out : undefined;
}

export const hub = new SessionHub();
