/** Theme: light | dark | system. Toggles `.dark` on `<html>` (matches agents-kit CSS vars). */

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "agentic-ui-kit-theme";

function systemDark(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolve(theme: Theme): "light" | "dark" {
  return theme === "system" ? (systemDark() ? "dark" : "light") : theme;
}

function apply(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", resolve(theme) === "dark");
  document.documentElement.dataset.theme = theme;
}

function readStored(): Theme {
  if (typeof localStorage === "undefined") return "system";
  const v = localStorage.getItem(STORAGE_KEY);
  if (v === "light" || v === "dark" || v === "system") return v;
  return "system";
}

/** Reactive theme preference (light / dark / system). */
export const theme = $state<{ value: Theme }>({ value: "system" });

let mediaBound = false;

function bindSystemListener() {
  if (typeof window === "undefined" || mediaBound) return;
  mediaBound = true;
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (theme.value === "system") apply("system");
  });
}

/** Call once at app boot (browser). */
export function initTheme(initial?: Theme) {
  theme.value = initial ?? readStored();
  apply(theme.value);
  bindSystemListener();
}

export function setTheme(next: Theme) {
  theme.value = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  apply(next);
  bindSystemListener();
}

export function toggleTheme() {
  const resolved = resolve(theme.value);
  setTheme(resolved === "dark" ? "light" : "dark");
}

export function cycleTheme() {
  const order: Theme[] = ["light", "dark", "system"];
  const i = order.indexOf(theme.value);
  setTheme(order[(i + 1) % order.length]);
}

/** Resolved light/dark after system. */
export function resolvedTheme(): "light" | "dark" {
  return resolve(theme.value);
}
