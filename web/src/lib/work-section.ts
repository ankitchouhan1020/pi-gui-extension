import type { ChatMessage } from "./api.ts";
import { getParts } from "./api.ts";

export function isComposerCommand(message: ChatMessage): boolean {
  return (
    message.role === "command" ||
    message.role === "bashExecution"
  );
}

/** Messages initiated directly from the composer must not join prior agent work. */
export function startsTopLevelTurn(message: ChatMessage): boolean {
  return message.role === "user" || isComposerCommand(message);
}

export function messageTimestamp(message: ChatMessage | undefined): number | null {
  const value = message?.timestamp;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function hasAssistantText(message: ChatMessage): boolean {
  if (message.role !== "assistant") return false;
  return getParts(message).some(
    (part) =>
      part.type !== "thinking" &&
      part.type !== "reasoning" &&
      part.type !== "toolCall" &&
      part.type !== "tool_use" &&
      typeof part.text === "string" &&
      Boolean(part.text.trim()),
  );
}

export function hasAssistantWork(message: ChatMessage): boolean {
  if (message.role !== "assistant") return false;
  if (typeof message.thinking === "string" && message.thinking.trim()) return true;
  return getParts(message).some(
    (part) =>
      part.type === "thinking" ||
      part.type === "reasoning" ||
      part.type === "toolCall" ||
      part.type === "tool_use",
  );
}

/** A terminal model response, as opposed to an assistant tool-use step. */
export function isFinalAssistantResponse(message: ChatMessage): boolean {
  if (!hasAssistantText(message)) return false;
  return message.stopReason === "stop" || message.stopReason === "length";
}

export function formatWorkDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.round(milliseconds / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}
