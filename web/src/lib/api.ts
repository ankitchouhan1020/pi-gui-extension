/** Thin fetch client for pi-gui server. */

export type SessionRow = {
  id: string;
  path?: string;
  cwd?: string;
  name?: string;
  sessionName?: string;
  created?: string | Date;
  modified?: string | Date;
  messageCount?: number;
  firstMessage?: string;
  running: boolean;
  streaming?: boolean;
  thinkingLevel?: string;
  thinking?: string;
  stats?: SessionStats;
  contextUsage?: ContextUsage;
  activeTools?: string[];
  isCompacting?: boolean;
  compacting?: boolean;
  isBashRunning?: boolean;
  pendingMessageCount?: number;
  model?: { provider?: string; id?: string; name?: string };
};

export type SessionStats = {
  sessionFile?: string;
  sessionId?: string;
  userMessages?: number;
  assistantMessages?: number;
  toolCalls?: number;
  toolResults?: number;
  totalMessages?: number;
  inputTokens?: number;
  outputTokens?: number;
  tokens?: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
  cost?: number | { total?: number };
  contextUsage?: ContextUsage;
};

export type ContextUsage = {
  tokens: number | null;
  contextWindow: number;
  percent: number | null;
};

export type ModelInfo = {
  provider: string;
  id: string;
  name: string;
  reasoning?: boolean;
  contextWindow?: number;
  maxTokens?: number;
};

export type ThinkingInfo = {
  level: string;
  available: string[];
  supports: boolean;
  thinkingLevel?: string;
  thinking?: string;
};

export type ToolInfo = {
  name: string;
  description?: string;
  parameters?: unknown;
  sourceInfo?: unknown;
};

export type ChatMessage = {
  role: string;
  content?: unknown;
  timestamp?: number | string;
  [key: string]: unknown;
};

/** Normalized content part from pi assistant / tool messages. */
export type ContentPart = {
  type: string;
  text?: string;
  thinking?: string;
  name?: string;
  id?: string;
  arguments?: unknown;
  toolCallId?: string;
  isError?: boolean;
  [key: string]: unknown;
};

export type ToolCallPart = ContentPart & {
  type: "toolCall" | "tool_use";
  name: string;
  arguments?: unknown;
  id?: string;
};

/** Session detail payload (GET /api/sessions/:id) — superset of list row. */
export type SessionDetail = SessionRow;

export function getHealth() {
  return req<{ ok: boolean; open: number; cwd?: string }>("/api/health");
}

/** List subdirectories for the in-app folder browser. */
export function listFs(path?: string) {
  const q = path ? `?path=${encodeURIComponent(path)}` : "";
  return req<{
    path: string;
    parent: string | null;
    home?: string;
    entries: { name: string; path: string }[];
  }>(`/api/fs${q}`);
}

/** One retry on hard network failure (server restart / empty reply). */
async function req<T>(path: string, init?: RequestInit, attempt = 0): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });
  } catch (e) {
    if (attempt < 1) {
      await new Promise((r) => setTimeout(r, 250));
      return req(path, init, attempt + 1);
    }
    const base = e instanceof Error ? e.message : String(e);
    // Browser: TypeError "Failed to fetch" when connection drops
    throw new Error(
      /failed to fetch|networkerror|load failed/i.test(base)
        ? "Server unreachable — is pi-gui running on :3847?"
        : base,
    );
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      code?: string;
    };
    const msg = body.error || res.statusText;
    const err = new Error(msg) as Error & { code?: string; status?: number };
    err.code = body.code;
    err.status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

export function listSessions(cwd?: string) {
  const q = cwd ? `?cwd=${encodeURIComponent(cwd)}` : "";
  return req<{ sessions: SessionRow[] }>(`/api/sessions${q}`);
}

export function openSession(body: {
  path?: string;
  cwd?: string;
  fresh?: boolean;
  /** Raw pi session JSONL (browser file picker upload). */
  content?: string;
  filename?: string;
}) {
  return req<SessionRow & { modelFallbackMessage?: string }>(`/api/sessions`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Import a session from file picker contents. */
export function importSession(content: string, filename?: string) {
  return openSession({ content, filename });
}

export function getSession(id: string) {
  return req<SessionDetail>(`/api/sessions/${encodeURIComponent(id)}`);
}

export function patchSession(id: string, body: { name?: string }) {
  return req<SessionRow>(`/api/sessions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/** Alias used by StatusBar. */
export function renameSession(id: string, name: string) {
  return patchSession(id, { name });
}

export function getMessages(id: string) {
  return req<{ messages: ChatMessage[] }>(
    `/api/sessions/${encodeURIComponent(id)}/messages`,
  );
}

/** Image payload for multimodal prompt/steer/follow-up (pi ImageContent). */
export type PromptImage = { type: "image"; data: string; mimeType: string };

export function prompt(id: string, message: string, images?: PromptImage[]) {
  return req<{ ok: boolean }>(`/api/sessions/${encodeURIComponent(id)}/prompt`, {
    method: "POST",
    body: JSON.stringify({ message, images }),
  });
}

/** Active ChatPanel send path — palette / external UI use this so optimistic UI + SSE stay in sync. */
type ChatPromptHandler = (text: string) => Promise<void>;
let chatPromptHandler: ChatPromptHandler | null = null;

export function registerChatPrompt(handler: ChatPromptHandler | null) {
  chatPromptHandler = handler;
}

/** Send through the open chat (optimistic bubble + streaming). */
export function chatPrompt(text: string) {
  if (!chatPromptHandler) {
    return Promise.reject(new Error("No active chat"));
  }
  return chatPromptHandler(text);
}

export function abort(id: string) {
  return req<{ ok: boolean }>(`/api/sessions/${encodeURIComponent(id)}/abort`, {
    method: "POST",
  });
}

export function closeSession(id: string) {
  return req<{ ok: boolean }>(`/api/sessions/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function listModels(sessionId?: string) {
  const q = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
  return req<{ models: ModelInfo[] }>(`/api/models${q}`);
}

export function setModel(
  id: string,
  body: { provider: string; id: string } | { cycle: "forward" | "backward" },
) {
  return req<SessionRow & { cycled?: unknown }>(
    `/api/sessions/${encodeURIComponent(id)}/model`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export function getSessionThinking(id: string) {
  return req<ThinkingInfo>(
    `/api/sessions/${encodeURIComponent(id)}/thinking`,
  );
}

export function setThinking(
  id: string,
  body: { level: string } | { cycle: true },
) {
  return req<ThinkingInfo>(
    `/api/sessions/${encodeURIComponent(id)}/thinking`,
    { method: "POST", body: JSON.stringify(body) },
  ).then((res) => ({
    ...res,
    thinkingLevel: res.thinkingLevel ?? res.level,
    thinking: res.thinking ?? res.level,
  }));
}

export function compact(id: string, instructions?: string) {
  return req<SessionRow & { ok: boolean; result?: unknown }>(
    `/api/sessions/${encodeURIComponent(id)}/compact`,
    {
      method: "POST",
      body: JSON.stringify(instructions != null ? { instructions } : {}),
    },
  );
}

/** Slim session tree node for `/tree` navigator. */
export type TreeNode = {
  id: string;
  type: string;
  role?: string;
  preview: string;
  label?: string;
  children: TreeNode[];
};

export function getTree(id: string) {
  return req<{ tree: TreeNode[]; leafId: string | null }>(
    `/api/sessions/${encodeURIComponent(id)}/tree`,
  );
}

/** Jump to a session entry (pi `/tree`). summarize defaults false. */
export function navigateTree(
  id: string,
  targetId: string,
  opts?: { summarize?: boolean; customInstructions?: string },
) {
  return req<
    SessionRow & {
      ok: boolean;
      alreadyThere?: boolean;
      leafId?: string | null;
      editorText?: string;
      cancelled?: boolean;
      aborted?: boolean;
    }
  >(`/api/sessions/${encodeURIComponent(id)}/tree`, {
    method: "POST",
    body: JSON.stringify({
      targetId,
      summarize: opts?.summarize,
      customInstructions: opts?.customInstructions,
    }),
  });
}

/** User message for pi `/fork` picker. */
export type ForkCandidate = { entryId: string; text: string };

export function listForkCandidates(id: string) {
  return req<{ messages: ForkCandidate[] }>(
    `/api/sessions/${encodeURIComponent(id)}/fork`,
  );
}

/**
 * New session file from an entry (pi `/fork` / `/clone`).
 * "before" = exclude user msg + put text in editor; "at" = include entry.
 */
export function forkSession(
  id: string,
  entryId: string,
  opts?: { position?: "before" | "at" },
) {
  return req<SessionRow & { selectedText?: string }>(
    `/api/sessions/${encodeURIComponent(id)}/fork`,
    {
      method: "POST",
      body: JSON.stringify({
        entryId,
        position: opts?.position === "at" ? "at" : "before",
      }),
    },
  );
}

/** One-shot draft after /fork (ChatPanel consumes on session wire). */
let pendingEditorText: string | null = null;

export function setPendingEditorText(text: string | undefined | null) {
  pendingEditorText = text?.trim() ? text : null;
}

export function takePendingEditorText(): string | null {
  const t = pendingEditorText;
  pendingEditorText = null;
  return t;
}

/** Alias used by StatusBar. */
export function compactSession(id: string, instructions?: string) {
  return compact(id, instructions);
}

export function steer(id: string, message: string, images?: PromptImage[]) {
  return req<{ ok: boolean }>(
    `/api/sessions/${encodeURIComponent(id)}/steer`,
    { method: "POST", body: JSON.stringify({ message, images }) },
  );
}

export function followUp(id: string, message: string, images?: PromptImage[]) {
  return req<{ ok: boolean }>(
    `/api/sessions/${encodeURIComponent(id)}/follow-up`,
    { method: "POST", body: JSON.stringify({ message, images }) },
  );
}

export function bash(
  id: string,
  command: string,
  opts?: { excludeFromContext?: boolean },
) {
  return req<{ ok: boolean }>(
    `/api/sessions/${encodeURIComponent(id)}/bash`,
    {
      method: "POST",
      body: JSON.stringify({
        command,
        excludeFromContext: opts?.excludeFromContext,
      }),
    },
  );
}

export function abortBash(id: string) {
  return req<{ ok: boolean }>(
    `/api/sessions/${encodeURIComponent(id)}/abort-bash`,
    { method: "POST" },
  );
}

export function getTools(id: string) {
  return req<{ tools: ToolInfo[]; active: string[] }>(
    `/api/sessions/${encodeURIComponent(id)}/tools`,
  );
}

export function setTools(id: string, active: string[]) {
  return req<{ tools: ToolInfo[]; active: string[] }>(
    `/api/sessions/${encodeURIComponent(id)}/tools`,
    { method: "POST", body: JSON.stringify({ active }) },
  );
}

export type SkillInfo = {
  name: string;
  description: string;
  filePath?: string;
  disableModelInvocation?: boolean;
  source?: string;
  scope?: string;
};

/** Skills available on an open session (pi `/skill:name`). */
export function listSkills(id: string) {
  return req<{ skills: SkillInfo[] }>(
    `/api/sessions/${encodeURIComponent(id)}/skills`,
  );
}

export type ExtensionInfo = {
  path: string;
  resolvedPath?: string;
  source?: string;
  scope?: string;
  origin?: string;
  commands: string[];
  tools: string[];
};

/** Extensions loaded for an open session (palette `/extensions`). */
export function listExtensions(id: string) {
  return req<{ extensions: ExtensionInfo[]; errors?: { path: string; error: string }[] }>(
    `/api/sessions/${encodeURIComponent(id)}/extensions`,
  );
}

/** Invocable slash command (pi `get_commands` — extension / prompt / skill). */
export type SlashCommandInfo = {
  name: string;
  description: string;
  source: "extension" | "prompt" | "skill" | string;
  argumentHint?: string;
  scope?: string;
};

/** Slash commands available via session.prompt (`/name`). */
export function listCommands(id: string) {
  return req<{ commands: SlashCommandInfo[] }>(
    `/api/sessions/${encodeURIComponent(id)}/commands`,
  );
}

/** Working-tree status for session cwd. */
export type GitFile = {
  path: string;
  oldPath?: string;
  xy: string;
  status: string;
};

export type GitStatus = {
  ok: boolean;
  error?: string;
  cwd?: string;
  branch?: string;
  files: GitFile[];
};

export type GitDiff = { path: string; patch: string };

export function getGitStatus(id: string) {
  return req<GitStatus>(`/api/sessions/${encodeURIComponent(id)}/git`);
}

export function getGitDiff(id: string, filePath: string) {
  return req<GitDiff>(
    `/api/sessions/${encodeURIComponent(id)}/git?path=${encodeURIComponent(filePath)}`,
  );
}

/** Stop the pi-gui server (localhost only). */
export function shutdown() {
  return req<{ ok: boolean }>("/api/shutdown", { method: "POST" });
}

/** Pi package changelog text (truncated server-side). */
export function getChangelog() {
  return req<{ version?: string; text: string }>("/api/changelog");
}

/** Trigger a browser file download. */
export function downloadText(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** SSE frame meta — seq from EventSource lastEventId (SSE id: line). */
export type SseFrameMeta = { seq: number; lastEventId: string };

/**
 * SSE subscription with resume cursor.
 * Pass `after` (last applied seq) so server can ring-replay or signal snapshot.
 * Returns close().
 */
export function subscribeEvents(
  id: string,
  onEvent: (ev: unknown, meta: SseFrameMeta) => void,
  onError?: (err: Event) => void,
  opts?: { after?: number },
) {
  const after = opts?.after && opts.after > 0 ? opts.after : 0;
  const q = after > 0 ? `?after=${encodeURIComponent(String(after))}` : "";
  const es = new EventSource(
    `/api/sessions/${encodeURIComponent(id)}/events${q}`,
  );
  es.onmessage = (e) => {
    try {
      const seq = Number(e.lastEventId);
      onEvent(JSON.parse(e.data), {
        seq: Number.isFinite(seq) && seq > 0 ? seq : 0,
        lastEventId: e.lastEventId || "",
      });
    } catch {
      /* ignore */
    }
  };
  es.onerror = (e) => onError?.(e);
  return () => es.close();
}

/** Short model id for list rows. */
export function shortModelId(
  model?: { provider?: string; id?: string; name?: string } | null,
): string {
  if (!model) return "";
  const raw = model.name || model.id || "";
  if (!raw) return "";
  const base = raw.includes("/") ? raw.split("/").pop()! : raw;
  return base.length > 28 ? base.slice(0, 26) + "…" : base;
}

/** e.g. "grok-4.5 [grok-agent-cli]" */
export function formatModelLabel(
  model?: { provider?: string; id?: string; name?: string } | null,
): string {
  if (!model) return "";
  const base = shortModelId(model);
  if (!base) return model.provider ? `[${model.provider}]` : "";
  return model.provider ? `${base} [${model.provider}]` : base;
}

/** data-URL or base64 image part → browser src. */
export function imagePartSrc(p: ContentPart): string | null {
  const mime = typeof p.mimeType === "string" ? p.mimeType : "";
  const data = typeof p.data === "string" ? p.data : "";
  if (!data) return null;
  if (data.startsWith("data:")) return data;
  if (!mime.startsWith("image/")) return null;
  return `data:${mime};base64,${data}`;
}

/** Normalize message content into parts. */
export function getParts(msg: ChatMessage): ContentPart[] {
  const c = msg.content;
  if (typeof c === "string") {
    return c ? [{ type: "text", text: c }] : [];
  }
  if (!Array.isArray(c)) return [];
  return c
    .map((part): ContentPart | null => {
      if (typeof part === "string") return part ? { type: "text", text: part } : null;
      if (!part || typeof part !== "object") return null;
      const p = part as ContentPart;
      return { ...p, type: String(p.type ?? ("text" in p ? "text" : "unknown")) };
    })
    .filter((p): p is ContentPart => p !== null);
}

/**
 * Visible text only (skips thinking; tool calls → short labels).
 */
export function messageText(msg: ChatMessage): string {
  if (msg.role === "bashExecution") {
    const cmd = typeof msg.command === "string" ? msg.command : "";
    const out = typeof msg.output === "string" ? msg.output : "";
    return `$ ${cmd}\n${out}`.trim();
  }
  if (
    msg.role === "compactionSummary" ||
    msg.role === "branchSummary" ||
    msg.role === "skillInvocation"
  ) {
    if (typeof msg.summary === "string") return msg.summary;
  }
  if (msg.role === "toolResult") {
    return getParts(msg)
      .map((p) => p.text ?? "")
      .filter(Boolean)
      .join("");
  }

  return getParts(msg)
    .map((p) => {
      if (p.type === "thinking" || p.type === "reasoning") return "";
      if (p.type === "toolCall" || p.type === "tool_use") {
        return `[tool: ${p.name ?? "?"}]`;
      }
      if (p.type === "text" || p.text) return p.text ?? "";
      return "";
    })
    .filter(Boolean)
    .join("");
}

/** Concatenated thinking/reasoning text from message content parts. */
export function getMessageThinking(msg: ChatMessage): string {
  const chunks: string[] = [];
  for (const p of getParts(msg)) {
    if (p.type === "thinking" || p.type === "reasoning") {
      if (typeof p.thinking === "string" && p.thinking) chunks.push(p.thinking);
      else if (typeof p.text === "string" && p.text) chunks.push(p.text);
    }
  }
  if (typeof msg.thinking === "string" && msg.thinking) chunks.push(msg.thinking);
  return chunks.join("\n\n").trim();
}

/** Alias for getMessageThinking (message body; not session thinking level API). */
export function getThinking(msg: ChatMessage): string {
  return getMessageThinking(msg);
}

/** Tool call parts from an assistant message. */
export function getToolCalls(msg: ChatMessage): ToolCallPart[] {
  return getParts(msg).filter(
    (p): p is ToolCallPart =>
      (p.type === "toolCall" || p.type === "tool_use") && Boolean(p.name),
  ) as ToolCallPart[];
}

/** Plain text segments (no thinking/tools). */
export function getTextParts(msg: ChatMessage): string {
  return getParts(msg)
    .filter(
      (p) =>
        p.type === "text" ||
        (p.type !== "thinking" &&
          p.type !== "reasoning" &&
          p.type !== "toolCall" &&
          p.type !== "tool_use" &&
          Boolean(p.text)),
    )
    .map((p) => p.text ?? "")
    .filter(Boolean)
    .join("");
}

/** Format unknown args/result for display. */
export function formatJsonish(value: unknown, max = 4000): string {
  if (value == null) return "";
  if (typeof value === "string") {
    return value.length > max ? value.slice(0, max) + "…" : value;
  }
  try {
    const s = JSON.stringify(value, null, 2);
    return s.length > max ? s.slice(0, max) + "…" : s;
  } catch {
    return String(value);
  }
}

/** Stable list key for chat rows (prefer server ids, then client `_key`). */
export function messageKey(msg: ChatMessage, index: number): string {
  if (typeof msg._key === "string" && msg._key) return msg._key;
  if (msg.role === "toolResult" && typeof msg.toolCallId === "string") {
    return `tr:${msg.toolCallId}`;
  }
  if (msg.role === "bashExecution" && typeof msg.command === "string") {
    return `bash:${msg.timestamp ?? ""}:${msg.command}`;
  }
  if (typeof msg.id === "string" && msg.id) return msg.id;
  const ts = msg.timestamp != null ? String(msg.timestamp) : "";
  const peek = messageText(msg).slice(0, 48);
  return `${index}:${msg.role}:${ts}:${peek}`;
}

export function clientMessageKey(): string {
  return `c:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

/** toolResult that already has a matching toolCall on a prior assistant message. */
export function isPairedToolResult(
  messages: ChatMessage[],
  index: number,
): boolean {
  const m = messages[index];
  if (!m || m.role !== "toolResult") return false;
  const callId =
    typeof m.toolCallId === "string"
      ? m.toolCallId
      : typeof m.id === "string"
        ? m.id
        : "";
  if (!callId) return false;
  for (let i = index - 1; i >= 0; i--) {
    const prev = messages[i];
    if (prev.role === "user") return false;
    if (prev.role !== "assistant") continue;
    return getParts(prev).some(
      (p) =>
        (p.type === "toolCall" || p.type === "tool_use") &&
        (p.id === callId || p.toolCallId === callId),
    );
  }
  return false;
}

/** Find toolResult for a toolCall id after an assistant message index. */
export function findToolResultForCall(
  messages: ChatMessage[],
  afterIndex: number,
  toolCallId: string,
): ChatMessage | undefined {
  if (!toolCallId) return undefined;
  for (let i = afterIndex + 1; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === "user" || m.role === "assistant") break;
    if (m.role === "toolResult" && m.toolCallId === toolCallId) return m;
  }
  return undefined;
}

/** Plain text body of a toolResult message. */
export function toolResultText(msg: ChatMessage): string {
  return getParts(msg)
    .map((p) => p.text ?? "")
    .filter(Boolean)
    .join("") || (typeof msg.content === "string" ? msg.content : "");
}
