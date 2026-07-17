/**
 * Chat stream pipeline — source of truth coordination for SSE + REST.
 *
 * Protocol:
 *   1. EventSource opens with ?after=<lastSeq>
 *   2. Server sends connected { id, seq, ringStart } (no SSE id)
 *   3. Cold/gap → REST snapshot, lastSeq := server seq, drain buffered live
 *   4. Resume   → apply only frames with seq > lastSeq (ring fills the hole)
 *   5. Messages merge by stable identity (id / toolCallId), not last-same-role
 */

export type ChatMessage = {
  role: string;
  content?: unknown;
  timestamp?: number | string;
  id?: string;
  toolCallId?: string;
  command?: string;
  output?: string;
  _key?: string;
  [key: string]: unknown;
};

export type TurnPhase = "idle" | "awaiting" | "streaming";

export type ConnectedInfo = {
  id?: string;
  seq: number;
  ringStart: number;
};

export type StreamEffect =
  | { type: "need_snapshot"; info: ConnectedInfo }
  | { type: "resumed"; info: ConnectedInfo }
  | { type: "messages" }
  | { type: "turn"; phase: TurnPhase }
  | { type: "settled" }
  | { type: "error"; error: string }
  | { type: "bash_running"; running: boolean }
  | { type: "queues"; steer: string[]; followUp: string[] }
  | { type: "thinking"; level: string }
  | { type: "session_name"; name: string }
  | { type: "compacting"; active: boolean; errorMessage?: string }
  | { type: "tree_navigated"; editorText?: string }
  | { type: "retry"; message: string }
  | { type: "retry_end"; success: boolean; finalError?: string };

const SEQ_STORE = "pi-gui-sse-seq:";

export function readStoredSeq(sessionId: string): number {
  try {
    const n = Number(sessionStorage.getItem(SEQ_STORE + sessionId));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function writeStoredSeq(sessionId: string, seq: number): void {
  try {
    if (seq > 0) sessionStorage.setItem(SEQ_STORE + sessionId, String(seq));
    else sessionStorage.removeItem(SEQ_STORE + sessionId);
  } catch {
    /* ignore */
  }
}

export function clearStoredSeq(sessionId: string): void {
  try {
    sessionStorage.removeItem(SEQ_STORE + sessionId);
  } catch {
    /* ignore */
  }
}

export function clientMessageKey(): string {
  return `c:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

/** Stable identity for merge (null = ephemeral / match by slot). */
export function messageIdentity(msg: ChatMessage): string | null {
  if (typeof msg.id === "string" && msg.id) return `id:${msg.id}`;
  if (msg.role === "toolResult") {
    const tc =
      (typeof msg.toolCallId === "string" && msg.toolCallId) ||
      (typeof msg.tool_use_id === "string" && msg.tool_use_id) ||
      "";
    if (tc) return `tr:${tc}`;
  }
  if (msg.role === "bashExecution" && typeof msg.command === "string") {
    return `bash:${msg.command}`;
  }
  return null;
}

export function peekText(msg: ChatMessage): string {
  const c = msg.content;
  if (typeof c === "string") return c;
  if (!Array.isArray(c)) return "";
  return c
    .map((p) => {
      if (typeof p === "string") return p;
      if (p && typeof p === "object" && typeof (p as { text?: string }).text === "string") {
        return (p as { text: string }).text;
      }
      return "";
    })
    .filter(Boolean)
    .join("");
}

export function shouldReplayRing(afterSeq: number, ringStart: number): boolean {
  if (!(afterSeq > 0)) return false;
  if (!(ringStart > 0)) return false;
  if (ringStart > afterSeq + 1) return false;
  return true;
}

/**
 * REST snapshot when:
 * - cold cursor (lastSeq=0)
 * - ring cannot fill the hole (gap)
 * - UI has no messages (hard refresh) — ring alone cannot rebuild history
 */
export function needSnapshot(
  lastSeq: number,
  info: ConnectedInfo,
  hasLocalMessages = true,
): boolean {
  if (!hasLocalMessages) return true;
  if (lastSeq <= 0) return true;
  if (info.ringStart > lastSeq + 1) return true;
  return false;
}

function mergeMsg(prev: ChatMessage, next: ChatMessage): ChatMessage {
  if (prev._key && !next._key) return { ...next, _key: prev._key };
  return next._key ? next : { ...next, _key: prev._key };
}

function replaceAt(
  list: ChatMessage[],
  index: number,
  msg: ChatMessage,
): ChatMessage[] {
  const copy = list.slice();
  copy[index] = msg;
  return copy;
}

function findByIdentity(list: ChatMessage[], msg: ChatMessage): number {
  const id = messageIdentity(msg);
  if (!id) return -1;
  for (let i = list.length - 1; i >= 0; i--) {
    if (messageIdentity(list[i]) === id) return i;
  }
  return -1;
}

function findOptimisticUser(list: ChatMessage[]): number {
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i];
    if (
      m.role === "user" &&
      typeof m._key === "string" &&
      m._key.startsWith("c:")
    ) {
      return i;
    }
  }
  return -1;
}

function findLastAssistantAfterUser(list: ChatMessage[]): number {
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].role === "user") return -1;
    if (list[i].role === "assistant") return i;
  }
  return -1;
}

function withKey(msg: ChatMessage): ChatMessage {
  return msg._key ? msg : { ...msg, _key: clientMessageKey() };
}

export class ChatStream {
  lastSeq = 0;
  messages: ChatMessage[] = [];
  phase: TurnPhase = "idle";
  sawServerStreaming = false;
  lastPromptAt = 0;
  sessionId: string | null = null;

  /** live = apply immediately; snapshotting = buffer until commitSnapshot */
  private mode: "live" | "snapshotting" = "live";
  private buffer: { seq: number; event: unknown }[] = [];
  /** In-flight assistant row without stable id yet */
  private liveAssistantIdx = -1;
  private liveBashCmd: string | null = null;

  get isSnapshotting(): boolean {
    return this.mode === "snapshotting";
  }

  bindSession(sessionId: string | null, opts?: { messages?: ChatMessage[] }) {
    if (sessionId && sessionId === this.sessionId) {
      if (opts?.messages) this.messages = opts.messages.slice();
      return;
    }
    this.sessionId = sessionId;
    this.lastSeq = sessionId ? readStoredSeq(sessionId) : 0;
    this.messages = opts?.messages ? opts.messages.slice() : [];
    this.phase = "idle";
    this.sawServerStreaming = false;
    this.lastPromptAt = 0;
    this.mode = "live";
    this.buffer = [];
    this.liveAssistantIdx = -1;
    this.liveBashCmd = null;
  }

  reset() {
    if (this.sessionId) clearStoredSeq(this.sessionId);
    this.sessionId = null;
    this.lastSeq = 0;
    this.messages = [];
    this.phase = "idle";
    this.sawServerStreaming = false;
    this.lastPromptAt = 0;
    this.mode = "live";
    this.buffer = [];
    this.liveAssistantIdx = -1;
    this.liveBashCmd = null;
  }

  private persistSeq() {
    if (this.sessionId && this.lastSeq > 0) {
      writeStoredSeq(this.sessionId, this.lastSeq);
    }
  }

  private setSeq(seq: number) {
    if (seq > this.lastSeq) {
      this.lastSeq = seq;
      this.persistSeq();
    }
  }

  /** Optimistic user row before POST /prompt resolves. */
  pushOptimisticUser(content: unknown): void {
    this.messages = [
      ...this.messages,
      {
        role: "user",
        content,
        timestamp: Date.now(),
        _key: clientMessageKey(),
      },
    ];
    this.phase = "awaiting";
    this.sawServerStreaming = false;
    this.lastPromptAt = Date.now();
  }

  markAwaiting(): void {
    this.phase = "awaiting";
    this.sawServerStreaming = false;
    this.lastPromptAt = Date.now();
  }

  clearTurn(): void {
    this.phase = "idle";
    this.sawServerStreaming = false;
    this.liveAssistantIdx = -1;
  }

  /**
   * Handle one SSE frame. seq=0 for connected (no id line).
   */
  handleFrame(seq: number, event: unknown): StreamEffect[] {
    if (!event || typeof event !== "object") return [];
    const e = event as Record<string, unknown>;

    if (e.type === "connected") {
      return this.onConnected(e);
    }

    if (seq > 0) {
      if (seq <= this.lastSeq) return [];
      if (this.mode === "snapshotting") {
        this.buffer.push({ seq, event });
        return [];
      }
      this.setSeq(seq);
    }

    return this.applyEvent(e);
  }

  private onConnected(e: Record<string, unknown>): StreamEffect[] {
    const info: ConnectedInfo = {
      id: typeof e.id === "string" ? e.id : undefined,
      seq: Number(e.seq) || 0,
      ringStart: Number(e.ringStart) || 0,
    };
    if (needSnapshot(this.lastSeq, info, this.messages.length > 0)) {
      this.mode = "snapshotting";
      this.buffer = [];
      return [{ type: "need_snapshot", info }];
    }
    this.mode = "live";
    return [{ type: "resumed", info }];
  }

  /**
   * Apply REST history as baseline. Drains frames buffered during snapshot.
   * serverSeq = connected.seq (high-water); never go backwards.
   */
  commitSnapshot(
    serverMessages: ChatMessage[],
    serverSeq: number,
  ): StreamEffect[] {
    this.messages = preserveOptimistic(this.messages, serverMessages);
    if (serverSeq > this.lastSeq) this.setSeq(serverSeq);
    this.mode = "live";
    this.liveAssistantIdx = -1;
    this.liveBashCmd = null;

    const buffered = this.buffer;
    this.buffer = [];
    const effects: StreamEffect[] = [{ type: "messages" }];
    for (const b of buffered) {
      if (b.seq > 0 && b.seq <= this.lastSeq) continue;
      if (b.seq > 0) this.setSeq(b.seq);
      effects.push(...this.applyEvent(b.event as Record<string, unknown>));
    }
    return effects;
  }

  /**
   * Mid-turn or settle REST reconcile — never clobber a longer local stream
   * with a lagging shorter server list unless force.
   */
  reconcileFromServer(
    serverMessages: ChatMessage[],
    opts?: { force?: boolean },
  ): StreamEffect[] {
    if (opts?.force || this.phase === "idle") {
      this.messages = preserveOptimistic(this.messages, serverMessages);
      this.liveAssistantIdx = -1;
      return [{ type: "messages" }];
    }
    if (
      serverMessages.length < this.messages.length &&
      (this.phase === "awaiting" || this.phase === "streaming")
    ) {
      // Merge known identities; keep optimistic / partial tail
      let local = this.messages.slice();
      for (const s of serverMessages) {
        const idx = findByIdentity(local, s);
        if (idx >= 0) {
          local = replaceAt(local, idx, mergeMsg(local[idx], s));
        }
      }
      this.messages = local;
      return [{ type: "messages" }];
    }
    this.messages = preserveOptimistic(this.messages, serverMessages);
    return [{ type: "messages" }];
  }

  /** Server idle while we thought a turn was open → settle if safe. */
  shouldSettleFromIdle(): boolean {
    if (this.phase === "idle") return true;
    if (this.sawServerStreaming) return true;
    if (this.phase === "awaiting" && Date.now() - this.lastPromptAt >= 4000) {
      return true;
    }
    return false;
  }

  /**
   * Align turn phase with REST session row (catch-up / snapshot).
   * @returns whether phase changed
   */
  noteServerBusy(streaming: boolean): boolean {
    if (streaming) {
      if (this.phase === "idle") {
        this.phase = "streaming";
        this.sawServerStreaming = true;
        return true;
      }
      this.sawServerStreaming = true;
      if (this.phase === "awaiting") {
        this.phase = "streaming";
        return true;
      }
      return false;
    }
    if (this.shouldSettleFromIdle()) {
      const was = this.phase;
      this.clearTurn();
      return was !== "idle";
    }
    return false;
  }

  upsertBash(
    command: string,
    output: string,
    extra: Partial<ChatMessage> = {},
  ): void {
    const id = `bash:${command}`;
    const copy = this.messages.slice();
    for (let i = copy.length - 1; i >= 0; i--) {
      if (messageIdentity(copy[i]) === id) {
        copy[i] = { ...copy[i], output, ...extra };
        this.messages = copy;
        this.liveBashCmd = command;
        return;
      }
    }
    this.messages = [
      ...copy,
      {
        role: "bashExecution",
        command,
        output,
        timestamp: Date.now(),
        _key: clientMessageKey(),
        ...extra,
      },
    ];
    this.liveBashCmd = command;
  }

  private applyEvent(e: Record<string, unknown>): StreamEffect[] {
    const type = e.type;
    switch (type) {
      case "message_start": {
        const msg = e.message as ChatMessage | undefined;
        if (!msg) return [];
        this.applyMessageStart(msg);
        const effects: StreamEffect[] = [{ type: "messages" }];
        if (msg.role === "assistant") {
          this.phase = "streaming";
          this.sawServerStreaming = true;
          effects.push({ type: "turn", phase: "streaming" });
        }
        return effects;
      }
      case "message_update": {
        const msg = e.message as ChatMessage | undefined;
        if (!msg) return [];
        this.applyMessageUpdate(msg, false);
        const effects: StreamEffect[] = [{ type: "messages" }];
        if (msg.role === "assistant") {
          this.phase = "streaming";
          this.sawServerStreaming = true;
          effects.push({ type: "turn", phase: "streaming" });
        }
        return effects;
      }
      case "message_end": {
        const msg = e.message as ChatMessage | undefined;
        if (!msg) return [];
        this.applyMessageUpdate(msg, true);
        return [{ type: "messages" }];
      }
      case "turn_start":
      case "agent_start":
        this.phase = "streaming";
        this.sawServerStreaming = true;
        return [{ type: "turn", phase: "streaming" }];
      case "auto_retry_start": {
        this.phase = "streaming";
        this.sawServerStreaming = true;
        const attempt = (e.attempt as number) ?? 0;
        const max = (e.maxAttempts as number) ?? 0;
        const why =
          typeof e.errorMessage === "string" && e.errorMessage
            ? e.errorMessage
            : "retrying";
        return [
          { type: "turn", phase: "streaming" },
          { type: "retry", message: `Retry ${attempt}/${max}: ${why}` },
        ];
      }
      case "auto_retry_end":
        return [
          {
            type: "retry_end",
            success: e.success !== false,
            finalError:
              typeof e.finalError === "string" ? e.finalError : undefined,
          },
        ];
      case "agent_end":
        if (e.willRetry) {
          this.phase = "streaming";
          return [{ type: "turn", phase: "streaming" }];
        }
        return [];
      case "agent_settled":
        this.clearTurn();
        return [{ type: "settled" }];
      case "error":
        return [
          {
            type: "error",
            error:
              typeof e.error === "string" && e.error
                ? e.error
                : "Agent error",
          },
        ];
      case "queue_update":
        return [
          {
            type: "queues",
            steer: [...((e.steering as string[]) ?? [])],
            followUp: [...((e.followUp as string[]) ?? [])],
          },
        ];
      case "thinking_level_changed":
        if (e.level != null) {
          return [{ type: "thinking", level: String(e.level) }];
        }
        return [];
      case "session_info_changed":
        if (e.name !== undefined) {
          return [{ type: "session_name", name: String(e.name ?? "") }];
        }
        return [];
      case "bash_start": {
        const command = typeof e.command === "string" ? e.command : "";
        if (command) {
          this.upsertBash(command, "", {
            excludeFromContext: e.excludeFromContext,
          });
        }
        return [
          { type: "bash_running", running: true },
          { type: "messages" },
        ];
      }
      case "bash_chunk": {
        const command = typeof e.command === "string" ? e.command : "";
        const chunk = typeof e.chunk === "string" ? e.chunk : "";
        if (command) {
          let prev = "";
          const id = `bash:${command}`;
          for (let i = this.messages.length - 1; i >= 0; i--) {
            if (messageIdentity(this.messages[i]) === id) {
              prev =
                typeof this.messages[i].output === "string"
                  ? (this.messages[i].output as string)
                  : "";
              break;
            }
          }
          this.upsertBash(command, prev + chunk);
        }
        return [{ type: "messages" }];
      }
      case "bash_end": {
        const command = typeof e.command === "string" ? e.command : "";
        const result = e.result as
          | { output?: string; exitCode?: number; cancelled?: boolean }
          | undefined;
        if (command) {
          this.upsertBash(
            command,
            typeof result?.output === "string" ? result.output : "",
            {
              exitCode: result?.exitCode,
              cancelled: result?.cancelled,
            },
          );
        }
        this.liveBashCmd = null;
        return [
          { type: "bash_running", running: false },
          { type: "messages" },
        ];
      }
      case "compaction_start":
        return [{ type: "compacting", active: true }];
      case "compaction_end":
        return [
          {
            type: "compacting",
            active: false,
            errorMessage:
              typeof e.errorMessage === "string" ? e.errorMessage : undefined,
          },
        ];
      case "tree_navigated":
        return [
          {
            type: "tree_navigated",
            editorText:
              typeof e.editorText === "string" ? e.editorText : undefined,
          },
        ];
      default:
        return [];
    }
  }

  private applyMessageStart(msg: ChatMessage): void {
    if (msg.role === "user") {
      const oi = findOptimisticUser(this.messages);
      if (oi >= 0) {
        this.messages = replaceAt(
          this.messages,
          oi,
          mergeMsg(this.messages[oi], withKey(msg)),
        );
        return;
      }
    }

    const idx = findByIdentity(this.messages, msg);
    if (idx >= 0) {
      this.messages = replaceAt(
        this.messages,
        idx,
        mergeMsg(this.messages[idx], withKey(msg)),
      );
      if (msg.role === "assistant") this.liveAssistantIdx = idx;
      return;
    }

    if (msg.role === "assistant" && this.liveAssistantIdx >= 0) {
      const i = this.liveAssistantIdx;
      this.messages = replaceAt(
        this.messages,
        i,
        mergeMsg(this.messages[i], withKey(msg)),
      );
      return;
    }

    const row = withKey(msg);
    this.messages = [...this.messages, row];
    if (msg.role === "assistant") {
      this.liveAssistantIdx = this.messages.length - 1;
    }
  }

  private applyMessageUpdate(msg: ChatMessage, isEnd: boolean): void {
    const idx = findByIdentity(this.messages, msg);
    if (idx >= 0) {
      this.messages = replaceAt(
        this.messages,
        idx,
        mergeMsg(this.messages[idx], withKey(msg)),
      );
      if (msg.role === "assistant") {
        this.liveAssistantIdx = isEnd ? -1 : idx;
      }
      return;
    }

    if (msg.role === "assistant") {
      const slot =
        this.liveAssistantIdx >= 0
          ? this.liveAssistantIdx
          : findLastAssistantAfterUser(this.messages);
      if (slot >= 0) {
        this.messages = replaceAt(
          this.messages,
          slot,
          mergeMsg(this.messages[slot], withKey(msg)),
        );
        this.liveAssistantIdx = isEnd ? -1 : slot;
        return;
      }
    }

    if (msg.role === "user") {
      const oi = findOptimisticUser(this.messages);
      if (oi >= 0) {
        this.messages = replaceAt(
          this.messages,
          oi,
          mergeMsg(this.messages[oi], withKey(msg)),
        );
        return;
      }
    }

    // New identity (e.g. first update without start, or new toolResult)
    const row = withKey(msg);
    this.messages = [...this.messages, row];
    if (msg.role === "assistant") {
      this.liveAssistantIdx = isEnd ? -1 : this.messages.length - 1;
    }
  }
}

/**
 * Prefer server list; keep client _key and trailing optimistic users
 * that have not landed on the server yet.
 */
export function preserveOptimistic(
  local: ChatMessage[],
  server: ChatMessage[],
): ChatMessage[] {
  const out = server.map((m) => ({ ...m }));

  // Transfer _key from local matches
  for (const loc of local) {
    if (!loc._key) continue;
    const id = messageIdentity(loc);
    if (id) {
      for (let i = 0; i < out.length; i++) {
        if (messageIdentity(out[i]) === id && !out[i]._key) {
          out[i] = { ...out[i], _key: loc._key };
          break;
        }
      }
      continue;
    }
    if (
      loc.role === "user" &&
      typeof loc._key === "string" &&
      loc._key.startsWith("c:")
    ) {
      const text = peekText(loc);
      let matched = false;
      for (let i = out.length - 1; i >= 0; i--) {
        if (out[i].role === "user" && peekText(out[i]) === text) {
          if (!out[i]._key) out[i] = { ...out[i], _key: loc._key };
          matched = true;
          break;
        }
      }
      if (!matched) {
        // Server empty/lagging — keep optimistic user
        out.push({ ...loc });
      }
    }
  }

  return out;
}
