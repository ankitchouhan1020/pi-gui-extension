import { onMount } from "svelte";

const MOBILE_BREAKPOINT = 768;

/** Reactive mobile breakpoint (max-width 767px), matching agents-kit `useIsMobile`. */
export function useIsMobile() {
  let isMobile = $state(false);

  onMount(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      isMobile = window.innerWidth < MOBILE_BREAKPOINT;
    };
    mql.addEventListener("change", onChange);
    onChange();
    return () => mql.removeEventListener("change", onChange);
  });

  return {
    get current() {
      return isMobile;
    },
  };
}
