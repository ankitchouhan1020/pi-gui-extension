/**
 * test-temp cleanup (node --test).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { makeTestCwd, cleanupTestCwd, sessionDirForCwd } from "./test-temp.js";

describe("test-temp cleanup", () => {
  it("removes cwd and linked pi session dir", () => {
    const cwd = makeTestCwd("pi-gui-tmpclean-");
    const sess = sessionDirForCwd(cwd);
    mkdirSync(sess, { recursive: true });
    writeFileSync(`${sess}/probe.jsonl`, "{}\n");
    assert.equal(existsSync(cwd), true);
    assert.equal(existsSync(sess), true);

    cleanupTestCwd(cwd);

    assert.equal(existsSync(cwd), false);
    assert.equal(existsSync(sess), false);
  });
});
