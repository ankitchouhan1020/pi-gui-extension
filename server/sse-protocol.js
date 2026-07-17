/**
 * SSE resume protocol for pi-gui.
 *
 * Cold open / gap  → client REST snapshot (no ring replay)
 * Hot resume       → ring replay for seq > after, then live
 */

/**
 * @param {number} afterSeq  client last applied seq (0 = cold)
 * @param {number} ringStart oldest seq still in ring (seq+1 if empty)
 * @returns {boolean}
 */
export function shouldReplayRing(afterSeq, ringStart) {
  const after = Number(afterSeq);
  const start = Number(ringStart);
  if (!Number.isFinite(after) || after <= 0) return false;
  if (!Number.isFinite(start) || start <= 0) return false;
  // Missing events before ringStart cannot be filled from ring
  if (start > after + 1) return false;
  return true;
}

/**
 * @param {{ id: string, seq: number, ringStart: number }} info
 */
export function connectedPayload(info) {
  return {
    type: "connected",
    id: info.id,
    seq: info.seq,
    ringStart: info.ringStart,
  };
}

/**
 * @param {{ seq: number, event: unknown }[]} ring
 * @param {number} currentSeq
 */
export function ringBounds(ring, currentSeq) {
  const seq = Number(currentSeq) || 0;
  const ringStart =
    ring.length > 0 ? ring[0].seq : seq > 0 ? seq + 1 : 1;
  return { seq, ringStart };
}
