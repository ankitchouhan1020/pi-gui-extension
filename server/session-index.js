/**
 * Index AgentSession instances in this process so /gui can attach the live TUI session.
 * Extension API does not expose AgentSession; subscribe/dispose are the stable hooks.
 */
import { AgentSession } from "@earendil-works/pi-coding-agent";

/** @type {Map<string, import("@earendil-works/pi-coding-agent").AgentSession>} */
const byId = new Map();
let hooked = false;

/** Install once; safe to call repeatedly. */
export function ensureSessionIndex() {
  if (hooked) return;
  hooked = true;

  const origSub = AgentSession.prototype.subscribe;
  AgentSession.prototype.subscribe = function subscribeIndexed(listener) {
    try {
      if (this.sessionId) byId.set(this.sessionId, this);
    } catch {
      /* ignore */
    }
    return origSub.call(this, listener);
  };

  const origDispose = AgentSession.prototype.dispose;
  AgentSession.prototype.dispose = function disposeIndexed() {
    try {
      byId.delete(this.sessionId);
    } catch {
      /* ignore */
    }
    return origDispose.call(this);
  };
}

/** @param {string} id */
export function getSessionById(id) {
  if (!id) return null;
  return byId.get(id) ?? null;
}
