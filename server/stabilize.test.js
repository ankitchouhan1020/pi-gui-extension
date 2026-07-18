/**
 * Minimal stabilize checks (node --test). No framework.
 * Run: node --test server/stabilize.test.js
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { slimSseEvent, formatSseEvent } from "./http.js";
import { SessionHub } from "./hub.js";
import { makeTestCwd, cleanupTestCwd } from "./test-temp.js";

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
    cwd = makeTestCwd("pi-gui-hub-");
    hub = new SessionHub();
  });

  after(async () => {
    try {
      await hub.disposeAll();
    } catch {
      /* ignore */
    }
    cleanupTestCwd(cwd);
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
    const baselineSeq = hub.ringInfo(a.id).seq;
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
    assert.equal(seqs[0], baselineSeq + 1);
    assert.equal(seqs[1], baselineSeq + 2);
    const after1 = hub.eventsAfter(a.id, seqs[0]);
    assert.equal(after1.length, seqs.length - 1);
    assert.equal(after1[0].seq, seqs[1]);
    assert.equal(hub.eventsAfter(a.id, 999).length, 0);
    const info = hub.ringInfo(a.id);
    assert.equal(info.seq, seqs[seqs.length - 1]);
    assert.ok(info.ringStart >= 1);
    await hub.close(a.id);
  });

  it("getMessages appends streamingMessage while streaming", async () => {
    const a = await hub.open({ cwd, fresh: true });
    const open = hub.require(a.id);
    const live = { role: "assistant", content: "partial…", id: "live-a" };
    Object.defineProperty(open.session, "isStreaming", {
      get: () => true,
      configurable: true,
    });
    // agent.state is mutable on real sessions
    if (open.session.agent?.state) {
      open.session.agent.state.streamingMessage = live;
    } else {
      open.session.agent = { state: { streamingMessage: live } };
    }
    const msgs = hub.getMessages(a.id);
    assert.ok(msgs.length >= 1);
    assert.equal(msgs[msgs.length - 1], live);
    // idle: no partial tail
    Object.defineProperty(open.session, "isStreaming", {
      get: () => false,
      configurable: true,
    });
    const idle = hub.getMessages(a.id);
    assert.equal(
      idle.some((m) => /** @type {{ id?: string }} */ (m).id === "live-a"),
      false,
    );
    await hub.close(a.id);
  });

  it("meta exposes id path cwd streaming model fields", async () => {
    const a = await hub.open({ cwd, fresh: true });
    const meta = hub.get(a.id);
    assert.equal(meta.id, a.id);
    assert.equal(meta.running, true);
    assert.equal(typeof meta.streaming, "boolean");
    assert.ok("path" in meta);
    assert.ok("cwd" in meta);
    assert.ok("model" in meta);
    assert.ok("thinkingLevel" in meta);
    assert.ok("messageCount" in meta);
    await hub.close(a.id);
  });

  it("abort delegates to session.abort", async () => {
    const a = await hub.open({ cwd, fresh: true });
    const open = hub.require(a.id);
    let aborted = false;
    open.session.abort = async () => {
      aborted = true;
    };
    await hub.abort(a.id);
    assert.equal(aborted, true);
    await hub.close(a.id);
  });

  it("steer while idle falls through to prompt", async () => {
    const a = await hub.open({ cwd, fresh: true });
    const open = hub.require(a.id);
    let prompted = false;
    Object.defineProperty(open.session, "isStreaming", {
      get: () => false,
      configurable: true,
    });
    open.session.prompt = async () => {
      prompted = true;
    };
    open.session.steer = async () => {
      throw new Error("should-not-steer");
    };
    await hub.steer(a.id, "hi");
    assert.equal(prompted, true);
    await hub.close(a.id);
  });

  it("native session.subscribe events reach hub listeners with seq", async () => {
    // Migration contract: hub fans out whatever the bound AgentSession emits.
    const a = await hub.open({ cwd, fresh: true });
    const baselineSeq = hub.ringInfo(a.id).seq;
    /** @type {{ type?: string }[]} */
    const events = [];
    /** @type {number[]} */
    const seqs = [];
    const unsub = hub.subscribe(a.id, (ev, seq) => {
      events.push(/** @type {{ type?: string }} */ (ev));
      seqs.push(seq);
    });
    const open = hub.require(a.id);
    assert.equal(typeof open.session._emit, "function");
    open.session._emit({
      type: "message_start",
      message: { role: "user", id: "u-nat", content: "hi" },
    });
    open.session._emit({ type: "agent_settled" });
    unsub();
    assert.deepEqual(
      events.map((e) => e.type),
      ["message_start", "agent_settled"],
    );
    assert.deepEqual(seqs, [baselineSeq + 1, baselineSeq + 2]);
    await hub.close(a.id);
  });
});

describe("SessionHub attach (bound / live)", () => {
  /** @type {SessionHub} */
  let hub;
  /** @type {string} */
  let cwd;

  before(() => {
    cwd = makeTestCwd("pi-gui-attach-");
    hub = new SessionHub();
  });

  after(async () => {
    try {
      await hub.disposeAll();
    } catch {
      /* ignore */
    }
    cleanupTestCwd(cwd);
  });

  it("attach then close detaches without dispose", async () => {
    const { createAgentSession, SessionManager } = await import(
      "@earendil-works/pi-coding-agent"
    );
    const { session } = await createAgentSession({
      cwd,
      sessionManager: SessionManager.create(cwd),
    });
    let disposed = false;
    const origDispose = session.dispose.bind(session);
    session.dispose = () => {
      disposed = true;
      return origDispose();
    };

    const meta = hub.attach(session, { cwd });
    assert.equal(meta.id, session.sessionId);
    assert.equal(hub.listOpen().some((s) => s.id === meta.id), true);

    /** @type {{ type?: string }[]} */
    const events = [];
    const unsub = hub.subscribe(meta.id, (ev) => {
      events.push(/** @type {{ type?: string }} */ (ev));
    });
    session._emit({ type: "agent_settled" });
    unsub();
    assert.equal(events[0]?.type, "agent_settled");

    await hub.close(meta.id);
    assert.equal(disposed, false);
    assert.equal(hub.listOpen().some((s) => s.id === meta.id), false);

    session.dispose();
    assert.equal(disposed, true);
  });

  it("attach same session twice is idempotent", async () => {
    const { createAgentSession, SessionManager } = await import(
      "@earendil-works/pi-coding-agent"
    );
    const { session } = await createAgentSession({
      cwd,
      sessionManager: SessionManager.create(cwd),
    });
    const a = hub.attach(session, { cwd });
    const b = hub.attach(session, { cwd });
    assert.equal(a.id, b.id);
    assert.equal(hub.listOpen().filter((s) => s.id === a.id).length, 1);
    hub.detach(a.id);
    session.dispose();
  });

  it("disposeAll detaches bound without dispose", async () => {
    const { createAgentSession, SessionManager } = await import(
      "@earendil-works/pi-coding-agent"
    );
    const { session } = await createAgentSession({
      cwd,
      sessionManager: SessionManager.create(cwd),
    });
    let disposed = false;
    const origDispose = session.dispose.bind(session);
    session.dispose = () => {
      disposed = true;
      return origDispose();
    };
    hub.attach(session, { cwd });
    await hub.disposeAll();
    assert.equal(disposed, false);
    session.dispose();
  });
});

describe("createServer stayAlive", () => {
  it("in-process listen and close without exit", async () => {
    const { createServer } = await import("./http.js");
    const app = createServer({ port: 0, stayAlive: true });
    await new Promise((resolve, reject) => {
      app.server.once("error", reject);
      app.listen(() => resolve(undefined));
    });
    const { port } = /** @type {{ port: number }} */ (app.server.address());
    const res = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(res.ok, true);
    await app.close();
    // second close should not throw hard (server already closed)
    await app.close().catch(() => {});
  });
});
