/**
 * SSE resume protocol (node --test).
 * Run: node --test server/sse-protocol.test.js
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  shouldReplayRing,
  connectedPayload,
  ringBounds,
} from "./sse-protocol.js";

describe("shouldReplayRing", () => {
  it("cold after=0 → no replay (client snapshots)", () => {
    assert.equal(shouldReplayRing(0, 1), false);
    assert.equal(shouldReplayRing(0, 10), false);
  });

  it("resume when after is inside or just before ring", () => {
    assert.equal(shouldReplayRing(9, 10), true); // next is ringStart
    assert.equal(shouldReplayRing(15, 10), true); // mid-ring
    assert.equal(shouldReplayRing(50, 10), true); // at/after head still ok
  });

  it("gap before ringStart → no replay", () => {
    assert.equal(shouldReplayRing(5, 10), false); // missing 6..9
    assert.equal(shouldReplayRing(1, 100), false);
  });
});

describe("connectedPayload + ringBounds", () => {
  it("connected includes seq and ringStart", () => {
    const p = connectedPayload({ id: "abc", seq: 42, ringStart: 10 });
    assert.deepEqual(p, {
      type: "connected",
      id: "abc",
      seq: 42,
      ringStart: 10,
    });
  });

  it("empty ring → ringStart = seq+1", () => {
    assert.deepEqual(ringBounds([], 7), { seq: 7, ringStart: 8 });
  });

  it("non-empty ring → ringStart = first seq", () => {
    assert.deepEqual(
      ringBounds(
        [
          { seq: 3, event: {} },
          { seq: 4, event: {} },
        ],
        4,
      ),
      { seq: 4, ringStart: 3 },
    );
  });
});
