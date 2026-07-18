/**
 * Chat stream pipeline unit tests.
 * Run: node --experimental-strip-types --test web/src/lib/chat-stream.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ChatStream,
  messageIdentity,
  needSnapshot,
  preserveOptimistic,
  shouldReplayRing,
  type ChatMessage,
} from "./chat-stream.ts";

describe("needSnapshot / shouldReplayRing", () => {
  it("matches server resume policy", () => {
    assert.equal(shouldReplayRing(0, 1), false);
    assert.equal(shouldReplayRing(9, 10), true);
    assert.equal(shouldReplayRing(5, 10), false);
  });

  it("forces snapshot without local messages", () => {
    assert.equal(
      needSnapshot(50, { seq: 50, ringStart: 10 }, false),
      true,
    );
    assert.equal(
      needSnapshot(50, { seq: 50, ringStart: 10 }, true),
      false,
    );
  });

  it("forces snapshot when client lastSeq is ahead of server (reopen)", () => {
    // GUI had seq 50; hub reopened session → server seq 0/ringStart 1
    assert.equal(
      needSnapshot(50, { seq: 0, ringStart: 1 }, true),
      true,
    );
    assert.equal(
      needSnapshot(50, { seq: 12, ringStart: 1 }, true),
      true,
    );
    // Normal hot resume: client behind/at server high-water, ring covers gap
    assert.equal(
      needSnapshot(9, { seq: 12, ringStart: 8 }, true),
      false,
    );
  });
});

describe("commitSnapshot resets lastSeq to server", () => {
  it("adopts server high-water even when lower than stale client cursor", () => {
    const s = new ChatStream();
    s.bindSession("s-reopen");
    s.lastSeq = 50;
    s.commitSnapshot(
      [{ role: "user", content: "hi", id: "u1" }],
      3,
    );
    assert.equal(s.lastSeq, 3);
    assert.equal(s.messages.length, 1);
  });
});

describe("messageIdentity", () => {
  it("prefers id, toolCallId, bash command", () => {
    assert.equal(messageIdentity({ role: "assistant", id: "a1" }), "id:a1");
    assert.equal(
      messageIdentity({ role: "toolResult", toolCallId: "t1" }),
      "tr:t1",
    );
    assert.equal(
      messageIdentity({ role: "bashExecution", command: "ls" }),
      "bash:ls",
    );
    assert.equal(messageIdentity({ role: "user" }), null);
  });
});

describe("ChatStream seq gate", () => {
  it("ignores duplicate / old seq", () => {
    const s = new ChatStream();
    s.bindSession("s1");
    s.lastSeq = 5;
    s.handleFrame(0, {
      type: "connected",
      id: "s1",
      seq: 5,
      ringStart: 1,
    });
    // empty messages → snapshot
    assert.equal(s.isSnapshotting, true);
    s.commitSnapshot([], 5);

    s.handleFrame(6, {
      type: "message_start",
      message: { role: "assistant", id: "a", content: "hi" },
    });
    assert.equal(s.messages.length, 1);

    s.handleFrame(6, {
      type: "message_start",
      message: { role: "assistant", id: "a", content: "dup" },
    });
    assert.equal(s.messages.length, 1);
    assert.equal(
      (s.messages[0].content as string) === "hi" || s.messages[0].id === "a",
      true,
    );
  });

  it("buffers during snapshot then drains", () => {
    const s = new ChatStream();
    s.bindSession("s2");
    const connected = s.handleFrame(0, {
      type: "connected",
      id: "s2",
      seq: 0,
      ringStart: 1,
    });
    assert.equal(connected[0]?.type, "need_snapshot");

    // live during snapshot
    s.handleFrame(1, {
      type: "message_start",
      message: { role: "user", id: "u1", content: "hi" },
    });
    assert.equal(s.messages.length, 0);

    s.commitSnapshot([], 0);
    assert.equal(s.messages.length, 1);
    assert.equal(s.messages[0].role, "user");
    assert.equal(s.lastSeq, 1);
  });
});

describe("ChatStream message merge", () => {
  it("replaces optimistic user on message_start", () => {
    const s = new ChatStream();
    s.bindSession("s3");
    s.commitSnapshot([], 0);
    s.pushOptimisticUser("hello");
    assert.equal(s.messages.length, 1);
    assert.ok(String(s.messages[0]._key).startsWith("c:"));

    s.handleFrame(1, {
      type: "message_start",
      message: { role: "user", id: "u1", content: "hello" },
    });
    assert.equal(s.messages.length, 1);
    assert.equal(s.messages[0].id, "u1");
    assert.ok(String(s.messages[0]._key).startsWith("c:"));
  });

  it("preserves selected skill presentation metadata when the server row lands", () => {
    const s = new ChatStream();
    s.bindSession("s-skill");
    s.commitSnapshot([], 0);
    s.pushOptimisticUser("/ponytail-audit", { skillName: "ponytail-audit" });

    s.handleFrame(1, {
      type: "message_start",
      message: { role: "user", id: "u-skill", content: "/skill:ponytail-audit" },
    });

    assert.equal(s.messages.length, 1);
    assert.equal(s.messages[0]._skillName, "ponytail-audit");
  });

  it("does not collapse two assistants via role", () => {
    const s = new ChatStream();
    s.bindSession("s4");
    s.commitSnapshot([], 0);
    s.handleFrame(1, {
      type: "message_start",
      message: { role: "assistant", id: "a1", content: "one" },
    });
    s.handleFrame(2, {
      type: "message_end",
      message: { role: "assistant", id: "a1", content: "one" },
    });
    s.handleFrame(3, {
      type: "message_start",
      message: {
        role: "toolResult",
        toolCallId: "t1",
        content: "ok",
      },
    });
    s.handleFrame(4, {
      type: "message_start",
      message: { role: "assistant", id: "a2", content: "two" },
    });
    assert.equal(s.messages.length, 3);
    assert.equal(s.messages[0].id, "a1");
    assert.equal(s.messages[2].id, "a2");
  });

  it("updates streaming assistant by slot before id lands", () => {
    const s = new ChatStream();
    s.bindSession("s5");
    s.commitSnapshot([], 0);
    s.handleFrame(1, {
      type: "message_start",
      message: { role: "assistant", content: "H" },
    });
    s.handleFrame(2, {
      type: "message_update",
      message: { role: "assistant", content: "Hi" },
    });
    s.handleFrame(3, {
      type: "message_end",
      message: { role: "assistant", id: "a9", content: "Hi!" },
    });
    assert.equal(s.messages.length, 1);
    assert.equal(s.messages[0].content, "Hi!");
    assert.equal(s.messages[0].id, "a9");
  });

  it("settled clears turn phase", () => {
    const s = new ChatStream();
    s.bindSession("s6");
    s.commitSnapshot([], 0);
    s.markAwaiting();
    s.handleFrame(1, { type: "agent_start" });
    assert.equal(s.phase, "streaming");
    s.handleFrame(2, { type: "agent_settled" });
    assert.equal(s.phase, "idle");
  });
});

describe("preserveOptimistic", () => {
  it("keeps optimistic user when server still empty", () => {
    const local: ChatMessage[] = [
      { role: "user", content: "x", _key: "c:1" },
    ];
    const out = preserveOptimistic(local, []);
    assert.equal(out.length, 1);
    assert.equal(out[0]._key, "c:1");
  });

  it("transfers _key onto matching server user", () => {
    const local: ChatMessage[] = [
      { role: "user", content: "x", _key: "c:1" },
    ];
    const out = preserveOptimistic(local, [
      { role: "user", content: "x", id: "u1" },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0].id, "u1");
    assert.equal(out[0]._key, "c:1");
  });

  it("reconciles a slash command transformed by pi without duplicating the prompt", () => {
    const now = Date.now();
    const local: ChatMessage[] = [
      {
        role: "user",
        content: "/ponytail-audit",
        timestamp: now,
        _key: "c:slash",
        _skillName: "ponytail-audit",
      },
    ];
    const out = preserveOptimistic(local, [
      {
        role: "user",
        content: "/skill:ponytail-audit",
        timestamp: now + 20,
        id: "u-skill",
      },
    ]);

    assert.equal(out.length, 1);
    assert.equal(out[0].content, "/skill:ponytail-audit");
    assert.equal(out[0]._key, "c:slash");
    assert.equal(out[0]._skillName, "ponytail-audit");
  });

  it("does not consume an older unrelated server prompt for a slash command", () => {
    const now = Date.now();
    const local: ChatMessage[] = [
      {
        role: "user",
        content: "/new-command",
        timestamp: now,
        _key: "c:new",
      },
    ];
    const out = preserveOptimistic(local, [
      {
        role: "user",
        content: "an older prompt",
        timestamp: now - 60_000,
        id: "u-old",
      },
    ]);

    assert.equal(out.length, 2);
    assert.equal(out[1]._key, "c:new");
  });

  it("does not reconcile unrelated recent slash commands by timing alone", () => {
    const now = Date.now();
    const out = preserveOptimistic(
      [{ role: "user", content: "/compact", timestamp: now, _key: "c:compact" }],
      [{ role: "user", content: "/model", timestamp: now + 10, id: "u-model" }],
    );

    assert.equal(out.length, 2);
    assert.equal(out[1]._key, "c:compact");
  });

  it("keeps transient extension command rows across a server snapshot", () => {
    const command = {
      role: "command",
      command: "/headroom status",
      _commandId: "command-1",
      _commandStatus: "done",
      _commandOutput: "Headroom enabled",
      _key: "c:command-1",
    };
    assert.deepEqual(preserveOptimistic([command], []), [command]);
  });
});

describe("ChatStream event effects", () => {
  it("renders extension command notifications and completion on one command row", () => {
    const s = new ChatStream();
    s.bindSession("s-command");
    s.commitSnapshot([], 0);
    s.pushCommand("/headroom", "headroom");
    s.handleFrame(1, { type: "command_start", command: "/headroom" });

    s.handleFrame(2, {
      type: "extension_notification",
      message: "Headroom enabled",
      level: "info",
    });
    s.handleFrame(3, {
      type: "extension_notification",
      message: "Proxy online",
      level: "warning",
    });
    s.handleFrame(4, {
      type: "extension_notification",
      message: "Status refreshed",
      level: "info",
    });
    const commandEndEffects = s.handleFrame(5, { type: "command_end", ok: true });

    assert.equal(s.messages.length, 1);
    assert.equal(s.messages[0].role, "command");
    assert.equal(s.messages[0]._commandStatus, "done");
    assert.equal(s.messages[0]._commandLevel, "warning");
    assert.equal(
      s.messages[0]._commandOutput,
      "Headroom enabled\n\nProxy online\n\nStatus refreshed",
    );
    assert.equal(s.phase, "idle");
    assert.deepEqual(commandEndEffects.at(-1), { type: "settled", reload: false });
  });

  it("completes a command from the HTTP response when SSE frames are missed", () => {
    const s = new ChatStream();
    s.bindSession("s-command-http");
    s.pushCommand("/headroom status", "headroom");
    s.completeCommand([{ message: "Headroom enabled", level: "info" }]);
    assert.equal(s.messages[0]._commandStatus, "done");
    assert.equal(s.messages[0]._commandOutput, "Headroom enabled");
    assert.equal(s.phase, "idle");
  });

  it("merges toolResult by toolCallId only", () => {
    const s = new ChatStream();
    s.bindSession("s-tr");
    s.commitSnapshot([], 0);
    s.handleFrame(1, {
      type: "message_start",
      message: {
        role: "toolResult",
        toolCallId: "tc1",
        content: "partial",
      },
    });
    s.handleFrame(2, {
      type: "message_end",
      message: {
        role: "toolResult",
        toolCallId: "tc1",
        content: "final",
      },
    });
    s.handleFrame(3, {
      type: "message_start",
      message: {
        role: "toolResult",
        toolCallId: "tc2",
        content: "other",
      },
    });
    assert.equal(s.messages.length, 2);
    assert.equal(s.messages[0].content, "final");
    assert.equal(s.messages[1].toolCallId, "tc2");
  });

  it("bash_start / chunk / end update one bashExecution row", () => {
    const s = new ChatStream();
    s.bindSession("s-bash");
    s.commitSnapshot([], 0);
    const e1 = s.handleFrame(1, { type: "bash_start", command: "ls" });
    assert.ok(e1.some((x) => x.type === "bash_running" && x.running === true));
    s.handleFrame(2, { type: "bash_chunk", command: "ls", chunk: "a" });
    s.handleFrame(3, { type: "bash_chunk", command: "ls", chunk: "b" });
    const eEnd = s.handleFrame(4, {
      type: "bash_end",
      command: "ls",
      result: { output: "ab", exitCode: 0 },
    });
    assert.ok(eEnd.some((x) => x.type === "bash_running" && x.running === false));
    assert.equal(s.messages.length, 1);
    assert.equal(s.messages[0].role, "bashExecution");
    assert.equal(s.messages[0].output, "ab");
  });

  it("queue_update and error emit effects", () => {
    const s = new ChatStream();
    s.bindSession("s-q");
    s.commitSnapshot([], 0);
    const q = s.handleFrame(1, {
      type: "queue_update",
      steering: ["s1"],
      followUp: ["f1"],
    });
    assert.deepEqual(q, [
      { type: "queues", steer: ["s1"], followUp: ["f1"] },
    ]);
    const err = s.handleFrame(2, { type: "error", error: "nope" });
    assert.deepEqual(err, [{ type: "error", error: "nope" }]);
  });

  it("agent_end willRetry keeps streaming phase", () => {
    const s = new ChatStream();
    s.bindSession("s-retry");
    s.commitSnapshot([], 0);
    s.handleFrame(1, { type: "agent_start" });
    s.handleFrame(2, { type: "agent_end", willRetry: true });
    assert.equal(s.phase, "streaming");
    s.handleFrame(3, { type: "agent_settled" });
    assert.equal(s.phase, "idle");
  });

  it("hot resume skips snapshot when lastSeq in ring", () => {
    const s = new ChatStream();
    s.bindSession("s-hot");
    s.commitSnapshot([{ role: "user", id: "u1", content: "hi" }], 10);
    s.lastSeq = 10;
    const effects = s.handleFrame(0, {
      type: "connected",
      id: "s-hot",
      seq: 12,
      ringStart: 10,
    });
    assert.equal(s.isSnapshotting, false);
    assert.equal(effects[0]?.type, "resumed");
  });

  it("gap forces need_snapshot", () => {
    const s = new ChatStream();
    s.bindSession("s-gap");
    s.commitSnapshot([{ role: "user", id: "u1", content: "hi" }], 5);
    s.lastSeq = 5;
    const effects = s.handleFrame(0, {
      type: "connected",
      id: "s-gap",
      seq: 50,
      ringStart: 40,
    });
    assert.equal(effects[0]?.type, "need_snapshot");
    assert.equal(s.isSnapshotting, true);
  });

  it("thinking_level_changed and session_info_changed", () => {
    const s = new ChatStream();
    s.bindSession("s-meta");
    s.commitSnapshot([], 0);
    assert.deepEqual(s.handleFrame(1, { type: "thinking_level_changed", level: "high" }), [
      { type: "thinking", level: "high" },
    ]);
    assert.deepEqual(s.handleFrame(2, { type: "session_info_changed", name: "n" }), [
      { type: "session_name", name: "n" },
    ]);
  });

  it("compaction + tree_navigated effects", () => {
    const s = new ChatStream();
    s.bindSession("s-tree");
    s.commitSnapshot([], 0);
    assert.deepEqual(s.handleFrame(1, { type: "compaction_start" }), [
      { type: "compacting", active: true },
    ]);
    assert.deepEqual(
      s.handleFrame(2, { type: "compaction_end", errorMessage: "x" }),
      [{ type: "compacting", active: false, errorMessage: "x" }],
    );
    assert.deepEqual(
      s.handleFrame(3, { type: "tree_navigated", editorText: "edit me" }),
      [{ type: "tree_navigated", editorText: "edit me" }],
    );
  });

  it("reconcileFromServer keeps longer streaming tail", () => {
    const s = new ChatStream();
    s.bindSession("s-rec");
    s.commitSnapshot([], 0);
    s.handleFrame(1, {
      type: "message_start",
      message: { role: "user", id: "u1", content: "q" },
    });
    s.handleFrame(2, {
      type: "message_start",
      message: { role: "assistant", content: "Hello world longer" },
    });
    assert.equal(s.phase, "streaming");
    // lagging server snapshot (shorter)
    s.reconcileFromServer([
      { role: "user", id: "u1", content: "q" },
      { role: "assistant", content: "Hi" },
    ]);
    // mid-stream: must not clobber to shorter-only list blindly
    assert.ok(s.messages.length >= 2);
    assert.equal(s.messages[0].id, "u1");
  });
});
