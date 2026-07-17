/**
 * Minimal stabilize checks (node --test). No framework.
 * Run: node --test server/stabilize.test.js
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { slimSseEvent, formatSseEvent } from "./http.js";
import { SessionHub } from "./hub.js";

describe("slimSseEvent", () => {
  it("strips assistantMessageEvent.partial", () => {
    const slim = slimSseEvent({
      type: "message_update",
      message: { role: "assistant", content: "hi" },
      assistantMessageEvent: { type: "text_delta", partial: { role: "assistant" }, delta: "h" },
    });
    assert.equal(slim.type, "message_update");
    assert.equal("partial" in slim.assistantMessageEvent, false);
    assert.equal(slim.assistantMessageEvent.delta, "h");
  });

  it("leaves other events alone", () => {
    const ev = { type: "agent_settled" };
    assert.equal(slimSseEvent(ev), ev);
  });

  it("formatSseEvent includes id line", () => {
    const frame = formatSseEvent({ type: "agent_settled" }, 42);
    assert.match(frame, /^id: 42\ndata: /);
    assert.ok(frame.endsWith("\n\n"));
    const data = frame.split("\n")[1].slice("data: ".length);
    assert.equal(JSON.parse(data).type, "agent_settled");
  });
});

describe("SessionHub open/close", () => {
  /** @type {SessionHub} */
  let hub;
  /** @type {string} */
  let cwd;

  before(() => {
    cwd = mkdtempSync(join(tmpdir(), "pi-gui-hub-"));
    hub = new SessionHub();
  });

  after(async () => {
    await hub.disposeAll();
    rmSync(cwd, { recursive: true, force: true });
  });

  it("open same path twice → same hub id", async () => {
    const a = await hub.open({ cwd, fresh: true });
    assert.ok(a.id);
    assert.ok(a.path);
    const b = await hub.open({ path: a.path, cwd });
    assert.equal(b.id, a.id);
    await hub.close(a.id);
  });

  it("list prefers hub id when running", async () => {
    const opened = await hub.open({ cwd, fresh: true });
    const rows = await hub.list(cwd);
    const row = rows.find((r) => r.path === opened.path || r.id === opened.id);
    assert.ok(row);
    assert.equal(row.running, true);
    assert.equal(row.id, opened.id);
    await hub.close(opened.id);
  });

  it("close then open path succeeds", async () => {
    const a = await hub.open({ cwd, fresh: true });
    const path = a.path;
    assert.ok(path);
    await hub.close(a.id);
    assert.equal(hub.listOpen().some((s) => s.id === a.id), false);
    const b = await hub.open({ path, cwd });
    assert.ok(b.id);
    assert.equal(b.path, path);
    await hub.close(b.id);
  });

  it("require finds open session by path", async () => {
    const a = await hub.open({ cwd, fresh: true });
    assert.ok(a.path);
    const meta = hub.get(a.path);
    assert.equal(meta.id, a.id);
    await hub.close(a.id);
  });

  it("ensure reopens imported session by id", async () => {
    // Fresh empty sessions have no file on disk until first write — import writes JSONL.
    const id = "019f6e50-0000-7000-8000-000000000001";
    const jsonl = [
      JSON.stringify({
        type: "session",
        version: 3,
        id,
        timestamp: new Date().toISOString(),
        cwd,
      }),
      JSON.stringify({
        type: "message",
        id: "m1",
        parentId: null,
        timestamp: new Date().toISOString(),
        message: { role: "user", content: "hi", timestamp: Date.now() },
      }),
    ].join("\n");
    const a = await hub.importContent(jsonl, { cwd, filename: `t-${id}.jsonl` });
    assert.equal(a.id, id);
    await hub.close(a.id);
    const s = await hub.ensure(id);
    assert.equal(s.id, id);
    await hub.close(s.id);
  });

  it("prompt failure emits SSE error + agent_settled", async () => {
    const a = await hub.open({ cwd, fresh: true });
    /** @type {unknown[]} */
    const events = [];
    const unsub = hub.subscribe(a.id, (ev) => events.push(ev));
    const open = hub.require(a.id);
    open.session.prompt = async () => {
      throw new Error("boom-test");
    };
    await assert.rejects(() => hub.prompt(a.id, "hi"), /boom-test/);
    unsub();
    const types = events.map((e) => /** @type {{ type?: string }} */ (e).type);
    assert.ok(types.includes("error"), `got ${types.join(",")}`);
    assert.ok(types.includes("agent_settled"), `got ${types.join(",")}`);
    const errEv = events.find(
      (e) => /** @type {{ type?: string }} */ (e).type === "error",
    );
    assert.equal(/** @type {{ error?: string }} */ (errEv).error, "boom-test");
    await hub.close(a.id);
  });

  it("streaming prompt routes to steer", async () => {
    const a = await hub.open({ cwd, fresh: true });
    const open = hub.require(a.id);
    let steered = false;
    Object.defineProperty(open.session, "isStreaming", {
      get: () => true,
      configurable: true,
    });
    open.session.steer = async () => {
      steered = true;
    };
    open.session.prompt = async () => {
      throw new Error("should-not-prompt");
    };
    await hub.prompt(a.id, "steer-me");
    assert.equal(steered, true);
    await hub.close(a.id);
  });

  it("different sessions run turns concurrently", async () => {
    const a = await hub.open({ cwd, fresh: true });
    const b = await hub.open({ cwd, fresh: true });
    assert.notEqual(a.id, b.id);
    const openA = hub.require(a.id);
    const openB = hub.require(b.id);

    /** @type {() => void} */
    let releaseA = () => {};
    /** @type {() => void} */
    let releaseB = () => {};
    const gateA = new Promise((r) => {
      releaseA = r;
    });
    const gateB = new Promise((r) => {
      releaseB = r;
    });
    let aStarted = false;
    let bStarted = false;

    openA.session.prompt = async () => {
      aStarted = true;
      await gateA;
    };
    openB.session.prompt = async () => {
      bStarted = true;
      await gateB;
    };

    const pa = hub.prompt(a.id, "from-a");
    const pb = hub.prompt(b.id, "from-b");

    // Both must enter prompt without waiting for the other to finish
    await new Promise((r) => setTimeout(r, 80));
    assert.equal(aStarted, true, "session A should start");
    assert.equal(bStarted, true, "session B should not wait on A");

    releaseA();
    releaseB();
    await Promise.all([pa, pb]);
    await hub.close(a.id);
    await hub.close(b.id);
  });

  it("same session serializes turns", async () => {
    const a = await hub.open({ cwd, fresh: true });
    const open = hub.require(a.id);
    const order = [];
    /** @type {() => void} */
    let releaseFirst = () => {};
    const firstGate = new Promise((r) => {
      releaseFirst = r;
    });

    open.session.prompt = async (text) => {
      order.push(`start:${text}`);
      if (text === "first") await firstGate;
      order.push(`end:${text}`);
    };

    const p1 = hub.prompt(a.id, "first");
    // Let first acquire the session-turn lock
    await new Promise((r) => setTimeout(r, 30));
    const p2 = hub.prompt(a.id, "second");
    await new Promise((r) => setTimeout(r, 50));
    assert.deepEqual(order, ["start:first"]);
    releaseFirst();
    await Promise.all([p1, p2]);
    assert.deepEqual(order, [
      "start:first",
      "end:first",
      "start:second",
      "end:second",
    ]);
    await hub.close(a.id);
  });

  it("sse ring assigns seq and eventsAfter filters", async () => {
    const a = await hub.open({ cwd, fresh: true });
    /** @type {number[]} */
    const seqs = [];
    const unsub = hub.subscribe(a.id, (_ev, seq) => seqs.push(seq));
    const open = hub.require(a.id);
    // Fail-turn emits error + agent_settled through #fanout
    open.session.prompt = async () => {
      throw new Error("ring-test");
    };
    await assert.rejects(() => hub.prompt(a.id, "x"), /ring-test/);
    unsub();
    assert.ok(seqs.length >= 2);
    assert.equal(seqs[0], 1);
    assert.equal(seqs[1], 2);
    const after1 = hub.eventsAfter(a.id, 1);
    assert.equal(after1.length, seqs.length - 1);
    assert.equal(after1[0].seq, 2);
    assert.equal(hub.eventsAfter(a.id, 999).length, 0);
    const info = hub.ringInfo(a.id);
    assert.equal(info.seq, seqs[seqs.length - 1]);
    assert.ok(info.ringStart >= 1);
    await hub.close(a.id);
  });
});
