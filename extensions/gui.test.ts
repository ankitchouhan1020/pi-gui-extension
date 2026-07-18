/**
 * /gui command arg parsing (node --experimental-strip-types --test).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseArgs } from "./gui.ts";

describe("parseArgs", () => {
  it("defaults to start on default port", () => {
    const a = parseArgs("");
    assert.equal(a.cmd, "start");
    assert.equal(typeof a.port, "number");
    assert.ok(a.port > 0);
    assert.equal(a.sessionRef, undefined);
  });

  it("parses stop", () => {
    assert.equal(parseArgs("stop").cmd, "stop");
    assert.equal(parseArgs("stop 4000").cmd, "stop");
    assert.equal(parseArgs("stop 4000").port, 4000);
  });

  it("treats takeover as start alias", () => {
    assert.equal(parseArgs("takeover").cmd, "start");
    assert.equal(parseArgs("takeover 4000").port, 4000);
  });

  it("parses custom port", () => {
    assert.equal(parseArgs("4000").port, 4000);
    assert.equal(parseArgs("start 9999").port, 9999);
  });

  it("parses session id", () => {
    const id = "019f73f2-9558-7634-8c7c-cf51e7141264";
    const a = parseArgs(id);
    assert.equal(a.cmd, "start");
    assert.equal(a.sessionRef, id);
    assert.ok(a.port > 0);
  });

  it("parses open <sessionId> and port", () => {
    const id = "019f73f2-9558-7634-8c7c-cf51e7141264";
    const a = parseArgs(`open ${id} 4000`);
    assert.equal(a.sessionRef, id);
    assert.equal(a.port, 4000);
  });

  it("parses session id then port", () => {
    const id = "abc-session-id";
    const a = parseArgs(`${id} 3848`);
    assert.equal(a.sessionRef, id);
    assert.equal(a.port, 3848);
  });
});
