<script lang="ts">
  import type { Snippet } from "svelte";
  import { cn } from "$lib/utils.js";
  import { onMount } from "svelte";
  import { animate } from "motion";

  /** Mirrors motion/react Transition (subset used by the React port). */
  export type AnimatedBackgroundTransition = {
    type?: "spring" | "tween" | "inertia" | string;
    stiffness?: number;
    damping?: number;
    mass?: number;
    duration?: number;
    ease?: string | number[];
    delay?: number;
  };

  type Props = {
    defaultValue?: string;
    onValueChange?: (newActiveId: string | null) => void;
    class?: string;
    transition?: AnimatedBackgroundTransition;
    enableHover?: boolean;
    children?: Snippet;
  };

  let {
    defaultValue,
    onValueChange,
    class: className,
    transition,
    enableHover = false,
    children,
  }: Props = $props();

  let activeId = $state<string | null>(null);
  let root: HTMLElement | null = $state(null);
  let bgEl: HTMLElement | null = $state(null);
  let hasPositioned = $state(false);

  let animControls: { stop: () => void } | null = null;
  let opacityControls: { stop: () => void } | null = null;

  function setActive(id: string | null) {
    activeId = id;
    onValueChange?.(id);
  }

  function motionOpts(extra: Record<string, unknown> = {}) {
    const t = transition ?? {};
    const type = t.type ?? "spring";
    if (type === "spring" || type === undefined) {
      return {
        type: "spring" as const,
        stiffness: t.stiffness ?? 300,
        damping: t.damping ?? 30,
        mass: t.mass ?? 0.8,
        delay: t.delay,
        ...extra,
      };
    }
    return {
      type: "tween" as const,
      duration: t.duration ?? 0.3,
      ease: t.ease ?? "easeOut",
      delay: t.delay,
      ...extra,
    };
  }

  /** motion DOM animate typings are narrow for CSS style props; cast keyframes. */
  function animateStyle(
    el: HTMLElement,
    keyframes: Record<string, string | number>,
    opts: ReturnType<typeof motionOpts>
  ) {
    return animate(el, keyframes as never, opts as never);
  }

  function measureAndAnimate() {
    if (!root || !bgEl) return;

    if (!activeId) {
      opacityControls?.stop();
      opacityControls = animateStyle(bgEl, { opacity: 0 }, motionOpts({ duration: 0.15 }));
      hasPositioned = false;
      return;
    }

    const el = root.querySelector(
      `[data-id="${CSS.escape(activeId)}"]`
    ) as HTMLElement | null;
    if (!el) {
      opacityControls?.stop();
      opacityControls = animateStyle(bgEl, { opacity: 0 }, motionOpts({ duration: 0.15 }));
      hasPositioned = false;
      return;
    }

    const parentRect = root.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    const left = rect.left - parentRect.left + root.scrollLeft;
    const top = rect.top - parentRect.top + root.scrollTop;
    const width = rect.width;
    const height = rect.height;

    // First paint: jump to rect (optionally start faded if no defaultValue)
    if (!hasPositioned) {
      bgEl.style.left = `${left}px`;
      bgEl.style.top = `${top}px`;
      bgEl.style.width = `${width}px`;
      bgEl.style.height = `${height}px`;
      const initialOpacity = defaultValue ? 1 : 0;
      bgEl.style.opacity = String(initialOpacity);
      hasPositioned = true;
      if (initialOpacity < 1) {
        opacityControls?.stop();
        opacityControls = animateStyle(bgEl, { opacity: 1 }, motionOpts());
      }
      return;
    }

    animControls?.stop();
    animControls = animateStyle(
      bgEl,
      {
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
        opacity: 1,
      },
      motionOpts()
    );
  }

  $effect(() => {
    if (defaultValue !== undefined) {
      activeId = defaultValue;
    }
  });

  $effect(() => {
    activeId;
    queueMicrotask(measureAndAnimate);
  });

  onMount(() => {
    if (!root) return;
    const nodes = root.querySelectorAll<HTMLElement>("[data-id]");
    const cleanups: Array<() => void> = [];

    nodes.forEach((node) => {
      node.classList.add("relative", "inline-flex");
      const id = node.getAttribute("data-id");
      if (!id) return;

      // Mirror React data-checked attribute
      const syncChecked = () => {
        node.setAttribute("data-checked", activeId === id ? "true" : "false");
      };
      syncChecked();

      if (enableHover) {
        const enter = () => setActive(id);
        const leave = () => setActive(null);
        node.addEventListener("mouseenter", enter);
        node.addEventListener("mouseleave", leave);
        cleanups.push(() => {
          node.removeEventListener("mouseenter", enter);
          node.removeEventListener("mouseleave", leave);
        });
      } else {
        const click = () => setActive(id);
        node.addEventListener("click", click);
        cleanups.push(() => node.removeEventListener("click", click));
      }
    });

    // Keep data-checked in sync when activeId changes
    const checkedEffect = () => {
      nodes.forEach((node) => {
        const id = node.getAttribute("data-id");
        if (id) node.setAttribute("data-checked", activeId === id ? "true" : "false");
      });
    };
    // Run once now; subsequent updates via $effect below are handled by re-query
    checkedEffect();

    const ro = new ResizeObserver(() => measureAndAnimate());
    ro.observe(root);
    measureAndAnimate();

    return () => {
      cleanups.forEach((fn) => fn());
      ro.disconnect();
      animControls?.stop();
      opacityControls?.stop();
    };
  });

  // Sync data-checked when activeId changes after mount
  $effect(() => {
    if (!root) return;
    activeId;
    root.querySelectorAll<HTMLElement>("[data-id]").forEach((node) => {
      const id = node.getAttribute("data-id");
      if (id) node.setAttribute("data-checked", activeId === id ? "true" : "false");
    });
  });
</script>

<div
  class="relative inline-flex isolate gap-1"
  bind:this={root}
  data-slot="animated-background"
>
  <!-- Shared sliding layer — visual equivalent of per-item layoutId bg (absolute inset-0 -z-10) -->
  <div
    bind:this={bgEl}
    class={cn("pointer-events-none absolute -z-10", className)}
    style="left: 0; top: 0; width: 0; height: 0; opacity: 0;"
    aria-hidden="true"
  ></div>
  {@render children?.()}
</div>
