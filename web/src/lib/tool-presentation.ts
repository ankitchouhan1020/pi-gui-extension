import type { ChatMessage, ContentPart } from "./api.ts";

type JsonObject = Record<string, unknown>;

export type BuiltinToolPresentation = {
  title: string;
  path: string;
  meta?: string;
  args: string;
  argsLabel: string;
  argsKind?: "code" | "diff";
  result: string;
  resultLabel: string;
  resultKind: "code" | "diff";
  resultLang?: string;
};

export type BashOutputPresentation = {
  label: "diff" | "output";
  kind: "diff" | "code";
  lang: "diff" | "bash";
};

function object(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function stringArg(args: JsonObject, ...keys: string[]): string {
  for (const key of keys) {
    if (typeof args[key] === "string") return args[key];
  }
  return "";
}

function editPreview(args: JsonObject, path: string): string {
  const edits = Array.isArray(args.edits)
    ? args.edits
    : [{ oldText: args.oldText, newText: args.newText }];
  const chunks: string[] = [];

  for (const candidate of edits) {
    const edit = object(candidate);
    if (!edit || typeof edit.oldText !== "string" || typeof edit.newText !== "string") {
      continue;
    }
    if (chunks.length === 0) chunks.push(`--- ${path}`, `+++ ${path}`);
    chunks.push("@@");
    chunks.push(...edit.oldText.split("\n").map((line) => `-${line}`));
    chunks.push(...edit.newText.split("\n").map((line) => `+${line}`));
  }

  return chunks.join("\n");
}

function readTitle(path: string, args: JsonObject): string {
  const offset = typeof args.offset === "number" ? args.offset : undefined;
  const limit = typeof args.limit === "number" ? args.limit : undefined;
  if (offset === undefined && limit === undefined) return `read ${path}`.trim();
  const start = offset ?? 1;
  const end = limit === undefined ? "" : `-${start + limit - 1}`;
  return `read ${path}:${start}${end}`.trim();
}

/** Keep standalone bash messages and tool-call bash results visually identical. */
export function bashOutputPresentation(command: string): BashOutputPresentation {
  const gitDiff = command.split(/&&|\|\||;|\n/).some((segment) => {
    const normalized = segment
      .trim()
      .replace(/^(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)*/, "");
    return /^(?:sudo\s+)?(?:\S*\/)?git(?:\s+(?:-C|-c|--git-dir|--work-tree)\s+\S+)*\s+diff(?:\s|$)/.test(
      normalized,
    );
  });
  return gitDiff
    ? { label: "diff", kind: "diff", lang: "diff" }
    : { label: "output", kind: "code", lang: "bash" };
}

/** Presentation for pi's built-in tools; null keeps the generic tool card. */
export function builtinToolPresentation(
  part: ContentPart,
  pairedResult: ChatMessage | undefined,
  resultText: string,
): BuiltinToolPresentation | null {
  const name = (part.name ?? "").toLowerCase();
  if (name !== "bash" && name !== "edit" && name !== "read" && name !== "write") {
    return null;
  }

  const args = object(part.arguments ?? part.input);
  if (!args) return null;

  if (name === "bash") {
    const command = stringArg(args, "command");
    if (!command) return null;
    const timeout = typeof args.timeout === "number" ? args.timeout : undefined;
    const output = bashOutputPresentation(command);
    return {
      title: `$ ${command}`,
      path: "",
      meta: timeout === undefined ? undefined : `timeout ${timeout}s`,
      args: "",
      argsLabel: "args",
      result: resultText,
      resultLabel: output.label,
      resultKind: output.kind,
      resultLang: output.lang,
    };
  }

  const path = stringArg(args, "path", "file_path");
  if (!path) return null;

  if (name === "read") {
    return {
      title: readTitle(path, args),
      path,
      args: "",
      argsLabel: "args",
      result: resultText,
      resultLabel: "content",
      resultKind: "code",
    };
  }

  if (name === "write") {
    const content = stringArg(args, "content");
    return {
      title: `write ${path}`,
      path,
      args: content,
      argsLabel: "content",
      argsKind: "code",
      result: resultText,
      resultLabel: "result",
      resultKind: "code",
    };
  }

  const details = object(pairedResult?.details);
  const completedDiff = details && typeof details.diff === "string" ? details.diff : "";
  const diff = completedDiff || (pairedResult?.isError ? "" : editPreview(args, path));
  return {
    title: `edit ${path}`,
    path,
    args: "",
    argsLabel: "args",
    result: diff || resultText,
    resultLabel: diff ? "diff" : "result",
    resultKind: diff ? "diff" : "code",
  };
}
