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
  });

  it("parses stop", () => {
    assert.equal(parseArgs("stop").cmd, "stop");
    assert.equal(parseArgs("stop 4000").cmd, "stop");
    assert.equal(parseArgs("stop 4000").port, 4000);
  });

  it("parses custom port", () => {
    assert.equal(parseArgs("4000").port, 4000);
    assert.equal(parseArgs("start 9999").port, 9999);
  });
});
