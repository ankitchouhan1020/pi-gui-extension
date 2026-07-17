<script lang="ts">
  /**
   * TextMorph — character morph like agents-kit (motion/react layoutId + popLayout).
   *
   * Implementation: manual FLIP with `motion` springs.
   * - Shared letter keys (case-insensitive + occurrence) keep identity and slide
   * - New keys fade/spring in; removed keys pop out of flow and fade out
   */
  import { cn } from "$lib/utils.js";
  import { animate, type AnimationPlaybackControls } from "motion";
  import { onDestroy, tick, untrack } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  export type TextMorphTransition = {
    type?: "spring" | "tween" | "inertia" | string;
    stiffness?: number;
    damping?: number;
    mass?: number;
    duration?: number;
  };

  type Props = Omit<HTMLAttributes<HTMLElement>, "children"> & {
    text?: string;
    as?: "p" | "span" | "div" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
    class?: string;
    transition?: TextMorphTransition;
  };

  type Glyph = {
    id: string;
    label: string;
    /** flowing = in layout; exit = absolute ghost fading out */
    mode: "flow" | "exit";
  };

  let {
    text = "",
    as = "p",
    class: className,
    style,
    transition: transitionProp,
    ...restProps
  }: Props = $props();

  const uniqueId = $props.id();

  const springDefaults = {
    type: "spring" as const,
    stiffness: 280,
    damping: 18,
    mass: 0.3,
  };

  function springOpts() {
    const t = transitionProp ?? {};
    if (t.type === "tween") {
      return {
        type: "tween" as const,
        duration: t.duration != null ? (t.duration < 10 ? t.duration : t.duration / 1000) : 0.25,
      };
    }
    return {
      type: "spring" as const,
      stiffness: t.stiffness ?? springDefaults.stiffness,
      damping: t.damping ?? springDefaults.damping,
      mass: t.mass ?? springDefaults.mass,
    };
  }

  function parseText(str: string): { id: string; label: string }[] {
    const counts: Record<string, number> = {};
    return Array.from(str).map((char) => {
      const keyChar = char === " " || char === "\u00A0" ? " " : char.toLowerCase();
      counts[keyChar] = (counts[keyChar] || 0) + 1;
      return {
        id: `${uniqueId}-${keyChar}${counts[keyChar]}`,
        label: char === " " || char === "\n" || char === "\t" ? "\u00A0" : char,
      };
    });
  }

  let root: HTMLElement | null = $state(null);
  let glyphs = $state<Glyph[]>([]);
  /** Screen positions before last commit */
  const prevBox = new Map<string, { left: number; top: number }>();
  const running = new Map<string, AnimationPlaybackControls>();
  let preferReduced = $state(false);
  let firstPaint = true;
  let gen = 0;

  // reduce motion
  let mq: MediaQueryList | null = null;
  if (typeof window !== "undefined") {
    mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    preferReduced = mq.matches;
    const onMq = () => {
      preferReduced = mq!.matches;
    };
    mq.addEventListener("change", onMq);
    onDestroy(() => mq?.removeEventListener("change", onMq));
  }

  function stopAnim(id: string) {
    running.get(id)?.stop();
    running.delete(id);
  }

  function measureAll() {
    if (!root) return;
    root.querySelectorAll<HTMLElement>("[data-morph-id]").forEach((el) => {
      const id = el.dataset.morphId;
      if (!id || el.dataset.mode === "exit") return;
      const r = el.getBoundingClientRect();
      prevBox.set(id, { left: r.left, top: r.top });
    });
  }

  function commitText(nextText: string) {
    const next = parseText(nextText);
    const nextIds = new Set(next.map((c) => c.id));
    const prevFlow = glyphs.filter((g) => g.mode === "flow");
    const prevIds = new Set(prevFlow.map((g) => g.id));

    // No-op if flowing content unchanged (avoids restarts / extra work)
    if (
      next.length === prevFlow.length &&
      next.every((c, i) => c.id === prevFlow[i]?.id && c.label === prevFlow[i]?.label)
    ) {
      return;
    }

    // Snapshot positions of current flowing glyphs before DOM swap
    measureAll();

    if (next.length === 0 && prevFlow.length === 0) {
      glyphs = [];
      return;
    }

    const exits: Glyph[] = prevFlow
      .filter((g) => !nextIds.has(g.id))
      .map((g) => ({ ...g, mode: "exit" as const }));

    // Preserve exit ghosts still animating (unless that id is re-entering)
    const stillExiting = glyphs.filter(
      (g) => g.mode === "exit" && !nextIds.has(g.id),
    );

    const exitMap = new Map<string, Glyph>();
    for (const g of [...stillExiting, ...exits]) exitMap.set(g.id, g);

    glyphs = [
      ...next.map((c) => ({
        id: c.id,
        label: c.label,
        mode: "flow" as const,
      })),
      ...exitMap.values(),
    ];

    const myGen = ++gen;
    tick().then(() => {
      if (myGen !== gen) return;
      runMotion(prevIds, nextIds);
    });
  }

  function runMotion(prevIds: Set<string>, nextIds: Set<string>) {
    const elRoot = root;
    if (!elRoot) return;

    if (preferReduced || firstPaint) {
      firstPaint = false;
      // settle boxes, drop exits immediately
      measureAll();
      glyphs = glyphs.filter((g) => g.mode === "flow");
      elRoot.querySelectorAll<HTMLElement>("[data-morph-id]").forEach((el) => {
        el.style.opacity = "1";
        el.style.transform = "";
      });
      return;
    }

    const opts = springOpts();
    const rootRect = elRoot.getBoundingClientRect();

    // Position exit ghosts at last known screen pos (popLayout)
    elRoot.querySelectorAll<HTMLElement>('[data-mode="exit"]').forEach((el) => {
      const id = el.dataset.morphId!;
      const box = prevBox.get(id);
      if (box) {
        el.style.position = "absolute";
        el.style.left = `${box.left - rootRect.left + elRoot.scrollLeft}px`;
        el.style.top = `${box.top - rootRect.top + elRoot.scrollTop}px`;
        el.style.margin = "0";
        el.style.pointerEvents = "none";
      }
      stopAnim(id);
      const ctrl = animate(
        el,
        { opacity: 0 },
        {
          ...opts,
          onComplete: () => {
            glyphs = glyphs.filter((g) => !(g.id === id && g.mode === "exit"));
            prevBox.delete(id);
            running.delete(id);
          },
        } as never,
      );
      running.set(id, ctrl);
    });

    // Flowing: enter or FLIP
    elRoot.querySelectorAll<HTMLElement>('[data-mode="flow"]').forEach((el) => {
      const id = el.dataset.morphId!;
      const now = el.getBoundingClientRect();
      const prev = prevBox.get(id);
      stopAnim(id);

      if (!prevIds.has(id)) {
        // enter
        el.style.opacity = "0";
        const ctrl = animate(el, { opacity: [0, 1], y: [4, 0] }, opts as never);
        running.set(id, ctrl);
      } else if (prev) {
        const dx = prev.left - now.left;
        const dy = prev.top - now.top;
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
          // FLIP: start from old visual position via motion x/y
          const ctrl = animate(el, { x: [dx, 0], y: [dy, 0] }, opts as never);
          running.set(id, ctrl);
        }
      }

      // update cache to current (post-layout) for next cycle
      prevBox.set(id, { left: now.left, top: now.top });
    });
  }

  // Track only `text`. commitText reads/writes `glyphs` — must be untracked
  // or the effect re-runs forever (effect_update_depth_exceeded).
  $effect(() => {
    const t = text;
    untrack(() => commitText(t));
  });

  onDestroy(() => {
    for (const c of running.values()) c.stop();
    running.clear();
  });

  const tag = $derived(as || "p");
</script>

<svelte:element
  this={tag}
  bind:this={root}
  class={cn("relative inline-flex flex-wrap items-baseline", className)}
  aria-label={text}
  {style}
  {...restProps}
>
  {#each glyphs as glyph (glyph.id + (glyph.mode === "exit" ? "-exit" : ""))}
    <span
      class="inline-block whitespace-pre will-change-transform"
      data-morph-id={glyph.id}
      data-mode={glyph.mode}
      aria-hidden="true"
    >
      {glyph.label}
    </span>
  {/each}
</svelte:element>
