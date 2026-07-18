import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatTokenCount,
  parseSkillCommand,
  parseSkillInvocation,
  skillNameForSlashCommand,
} from "./special-message.ts";

describe("parseSkillInvocation", () => {
  it("extracts the skill metadata, instructions, and trailing user prompt", () => {
    assert.deepEqual(
      parseSkillInvocation(
        '<skill name="review" location="/skills/review/SKILL.md">\n# Review\nCheck carefully.\n</skill>\n\nReview this change',
      ),
      {
        name: "review",
        location: "/skills/review/SKILL.md",
        content: "# Review\nCheck carefully.",
        userMessage: "Review this change",
      },
    );
  });

  it("does not reinterpret ordinary user messages", () => {
    assert.equal(parseSkillInvocation("use the review skill"), null);
  });
});

describe("skillNameForSlashCommand", () => {
  const commands = [
    { name: "ponytail-audit", source: "extension", description: "Run /skill:ponytail-audit" },
    { name: "skill:ponytail-audit", source: "skill", description: "Audit" },
    { name: "unrelated", source: "extension", description: "Does something else" },
  ];

  it("recognizes canonical skills and explicit extension aliases", () => {
    assert.equal(skillNameForSlashCommand(commands[1], commands), "ponytail-audit");
    assert.equal(skillNameForSlashCommand(commands[0], commands), "ponytail-audit");
  });

  it("does not decorate unrelated extension commands", () => {
    assert.equal(skillNameForSlashCommand(commands[2], commands), null);
  });
});

describe("parseSkillCommand", () => {
  it("recognizes canonical skill commands and optional arguments", () => {
    assert.deepEqual(parseSkillCommand("/skill:ponytail-audit"), {
      name: "ponytail-audit",
      userMessage: undefined,
    });
    assert.deepEqual(parseSkillCommand("/skill:review audit this diff"), {
      name: "review",
      userMessage: "audit this diff",
    });
  });

  it("leaves other slash commands alone", () => {
    assert.equal(parseSkillCommand("/compact"), null);
  });
});

describe("formatTokenCount", () => {
  it("formats valid token metadata", () => {
    assert.equal(formatTokenCount(42123), "42,123");
    assert.equal(formatTokenCount(undefined), "");
  });
});
