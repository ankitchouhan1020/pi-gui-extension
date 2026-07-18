import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatWorkDuration,
  hasAssistantText,
  hasAssistantWork,
  isComposerCommand,
  isFinalAssistantResponse,
  messageTimestamp,
  startsTopLevelTurn,
} from "./work-section.ts";

describe("work section helpers", () => {
  it("separates tool work from a terminal assistant response", () => {
    const work = {
      role: "assistant",
      stopReason: "toolUse",
      content: [
        { type: "thinking", thinking: "Inspecting" },
        { type: "toolCall", name: "read", id: "r1", arguments: { path: "a.ts" } },
      ],
    };
    const final = {
      role: "assistant",
      stopReason: "stop",
      content: [
        { type: "thinking", thinking: "Done" },
        { type: "text", text: "Implemented." },
      ],
    };
    assert.equal(hasAssistantWork(work), true);
    assert.equal(isFinalAssistantResponse(work), false);
    assert.equal(hasAssistantWork(final), true);
    assert.equal(hasAssistantText(final), true);
    assert.equal(isFinalAssistantResponse(final), true);
  });

  it("formats stored timestamps and elapsed work time", () => {
    assert.equal(messageTimestamp({ role: "user", timestamp: "2026-07-18T10:00:00Z" }), Date.parse("2026-07-18T10:00:00Z"));
    assert.equal(formatWorkDuration(79_000), "1m 19s");
    assert.equal(formatWorkDuration(3_600_000), "1h");
  });

  it("keeps composer commands out of the preceding Worked section", () => {
    assert.equal(startsTopLevelTurn({ role: "user" }), true);
    assert.equal(startsTopLevelTurn({ role: "command" }), true);
    assert.equal(startsTopLevelTurn({ role: "bashExecution" }), true);
    assert.equal(isComposerCommand({ role: "command" }), true);
    assert.equal(isComposerCommand({ role: "bashExecution" }), true);
    assert.equal(isComposerCommand({ role: "user" }), false);
    assert.equal(startsTopLevelTurn({ role: "assistant" }), false);
    assert.equal(startsTopLevelTurn({ role: "toolResult" }), false);
  });
});
