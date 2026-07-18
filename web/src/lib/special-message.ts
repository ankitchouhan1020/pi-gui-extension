export type SkillInvocation = {
  name: string;
  location: string;
  content: string;
  userMessage?: string;
};

export type SkillCommand = {
  name: string;
  userMessage?: string;
};

type SlashLike = {
  name: string;
  source: string;
  description?: string;
};

/** Parse pi's native skill-expanded user message format. */
export function parseSkillInvocation(text: string): SkillInvocation | null {
  const match = text.match(
    /^<skill name="([^"]+)" location="([^"]+)">\r?\n([\s\S]*?)\r?\n<\/skill>(?:\r?\n\r?\n([\s\S]+))?$/,
  );
  if (!match) return null;
  return {
    name: match[1],
    location: match[2],
    content: match[3],
    userMessage: match[4]?.trim() || undefined,
  };
}

/** Parse the canonical command when pi stores a skill selection before expansion. */
export function parseSkillCommand(text: string): SkillCommand | null {
  const match = text.trim().match(/^\/skill:([^\s]+)(?:\s+([\s\S]+))?$/);
  if (!match) return null;
  return {
    name: match[1],
    userMessage: match[2]?.trim() || undefined,
  };
}

/** Resolve both canonical `/skill:name` entries and explicit command aliases. */
export function skillNameForSlashCommand(
  command: SlashLike,
  commands: SlashLike[],
): string | null {
  if (command.source === "skill" && command.name.startsWith("skill:")) {
    return command.name.slice("skill:".length) || null;
  }

  const canonicalName = `skill:${command.name}`;
  const hasCanonicalSkill = commands.some(
    (item) => item.source === "skill" && item.name === canonicalName,
  );
  if (!hasCanonicalSkill) return null;

  const description = command.description?.trim() ?? "";
  return description.includes(`/skill:${command.name}`) ? command.name : null;
}

export function formatTokenCount(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return Math.max(0, Math.round(value)).toLocaleString("en-US");
}
