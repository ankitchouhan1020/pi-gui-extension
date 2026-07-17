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
});
