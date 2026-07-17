<script lang="ts">
  import { Tabs as TabsPrimitive } from "bits-ui";
  import { cn } from "$lib/utils.js";
  import { animate } from "motion";

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: TabsPrimitive.ListProps = $props();

  let indicatorEl: HTMLElement | null = $state(null);
  let hasPositioned = false;
  let animControls: { stop: () => void } | null = null;
  let observers: { mo: MutationObserver; ro: ResizeObserver; el: HTMLElement } | null =
    null;

  /** React tabs indicator spring: stiffness 26.7, damping 4.1, mass 0.2 */
  const spring = {
    type: "spring" as const,
    stiffness: 26.7,
    damping: 4.1,
    mass: 0.2,
  };

  function animateStyle(
    el: HTMLElement,
    keyframes: Record<string, string | number>,
    opts: Record<string, unknown>
  ) {
    return animate(el, keyframes as never, opts as never);
  }

  function updateIndicator(listEl: HTMLElement) {
    if (!indicatorEl) return;

    const active = listEl.querySelector(
      '[data-state="active"], [aria-selected="true"]'
    ) as HTMLElement | null;

    if (!active) {
      animControls?.stop();
      animControls = animateStyle(indicatorEl, { opacity: 0 }, { duration: 0.12 });
      hasPositioned = false;
      return;
    }

    const listRect = listEl.getBoundingClientRect();
    const rect = active.getBoundingClientRect();
    // Match React: bar is w-4/5 of trigger, centered
    const barWidth = rect.width * 0.8;
    const left =
      rect.left - listRect.left + (rect.width - barWidth) / 2 + listEl.scrollLeft;
    const target = {
      left: `${left}px`,
      width: `${barWidth}px`,
      opacity: 1,
    };

    if (!hasPositioned) {
      indicatorEl.style.left = target.left;
      indicatorEl.style.width = target.width;
      indicatorEl.style.opacity = "1";
      hasPositioned = true;
      return;
    }

    animControls?.stop();
    animControls = animateStyle(indicatorEl, target, spring);
  }

  function detachObservers() {
    if (!observers) return;
    observers.mo.disconnect();
    observers.ro.disconnect();
    observers = null;
  }

  function attachObservers(listEl: HTMLElement) {
    if (observers?.el === listEl) {
      updateIndicator(listEl);
      return;
    }
    detachObservers();

    const mo = new MutationObserver(() => updateIndicator(listEl));
    mo.observe(listEl, {
      attributes: true,
      attributeFilter: ["data-state", "aria-selected"],
      subtree: true,
      childList: true,
    });

    const ro = new ResizeObserver(() => updateIndicator(listEl));
    ro.observe(listEl);

    observers = { mo, ro, el: listEl };
    requestAnimationFrame(() => updateIndicator(listEl));
  }

  // bits-ui ref is the DOM node once mounted
  $effect(() => {
    const listEl = ref as HTMLElement | null;
    const indicator = indicatorEl;
    if (!listEl || !indicator) return;

    attachObservers(listEl);

    return () => {
      detachObservers();
      animControls?.stop();
    };
  });
</script>

<TabsPrimitive.List
  bind:ref
  data-slot="tabs-list"
  class={cn(
    "relative inline-flex h-10 w-full items-center justify-start border-b border-zinc-200 bg-transparent text-zinc-900 dark:border-zinc-800 dark:text-zinc-50",
    className
  )}
  {...restProps}
>
  <!-- Shared sliding underline (layoutId equivalent) -->
  <div
    bind:this={indicatorEl}
    class="pointer-events-none absolute bottom-0 z-10 h-0.5 bg-zinc-950 opacity-0 dark:bg-white"
    style="left: 0; width: 0;"
    aria-hidden="true"
  ></div>
  {@render children?.()}
</TabsPrimitive.List>
