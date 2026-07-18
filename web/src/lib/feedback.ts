export type FeedbackCue = "send" | "success" | "error" | "toggle";

const SOUND_KEY = "pi-gui-sound-enabled";
const SOUND_EVENT = "pi-gui:sound-change";
const DEFAULT_GAIN = 0.035;

let context: AudioContext | null = null;
let lastPlayed = new Map<FeedbackCue, number>();

function canUseAudio() {
  return typeof window !== "undefined" && typeof window.AudioContext !== "undefined";
}

export function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

export function isSoundEnabled() {
  if (typeof window === "undefined" || prefersReducedMotion()) return false;
  try {
    return window.localStorage.getItem(SOUND_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SOUND_KEY, enabled ? "1" : "0");
  } catch {
    /* Preferences remain available for this tab even if storage is blocked. */
  }
  window.dispatchEvent(new CustomEvent(SOUND_EVENT, { detail: enabled }));
  if (enabled) playFeedback("toggle", { force: true });
}

export function subscribeSoundEnabled(callback: (enabled: boolean) => void) {
  if (typeof window === "undefined") return () => {};
  const update = (event?: Event) => {
    const detail = (event as CustomEvent<boolean> | undefined)?.detail;
    callback(typeof detail === "boolean" && !prefersReducedMotion() ? detail : isSoundEnabled());
  };
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  update();
  window.addEventListener(SOUND_EVENT, update);
  window.addEventListener("storage", update);
  media.addEventListener("change", update);
  return () => {
    window.removeEventListener(SOUND_EVENT, update);
    window.removeEventListener("storage", update);
    media.removeEventListener("change", update);
  };
}

type Tone = {
  frequency: number;
  endFrequency?: number;
  offset: number;
  duration: number;
  gain: number;
  type?: OscillatorType;
};

const CUES: Record<FeedbackCue, Tone[]> = {
  send: [
    { frequency: 420, endFrequency: 560, offset: 0, duration: 0.055, gain: 0.45 },
  ],
  success: [
    { frequency: 520, endFrequency: 610, offset: 0, duration: 0.08, gain: 0.42 },
    { frequency: 720, endFrequency: 820, offset: 0.065, duration: 0.12, gain: 0.34 },
  ],
  error: [
    {
      frequency: 260,
      endFrequency: 220,
      offset: 0,
      duration: 0.12,
      gain: 0.38,
      type: "triangle",
    },
  ],
  toggle: [
    { frequency: 620, endFrequency: 760, offset: 0, duration: 0.07, gain: 0.32 },
  ],
};

export function playFeedback(cue: FeedbackCue, options?: { force?: boolean }) {
  if (!canUseAudio() || prefersReducedMotion()) return;
  if (!options?.force && !isSoundEnabled()) return;

  const now = Date.now();
  if (now - (lastPlayed.get(cue) ?? 0) < 500) return;
  lastPlayed.set(cue, now);

  try {
    context ??= new window.AudioContext();
    if (context.state === "suspended") void context.resume();
    const start = context.currentTime + 0.008;

    for (const tone of CUES[cue]) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const toneStart = start + tone.offset;
      const toneEnd = toneStart + tone.duration;
      oscillator.type = tone.type ?? "sine";
      oscillator.frequency.setValueAtTime(tone.frequency, toneStart);
      oscillator.frequency.exponentialRampToValueAtTime(
        tone.endFrequency ?? tone.frequency,
        toneEnd,
      );
      gain.gain.setValueAtTime(0.0001, toneStart);
      gain.gain.exponentialRampToValueAtTime(DEFAULT_GAIN * tone.gain, toneStart + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, toneEnd);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(toneStart);
      oscillator.stop(toneEnd + 0.01);
    }
  } catch {
    /* Audio feedback is optional; unsupported or blocked audio never affects UX. */
  }
}
