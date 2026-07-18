/**
 * App-facing surface of the vendored agentic UI kit.
 * Demo blocks and unused agents-ui components are intentionally not vendored.
 */
export { cn } from "./utils.js";
export {
  theme,
  initTheme,
  setTheme,
  toggleTheme,
  cycleTheme,
  resolvedTheme,
  type Theme,
} from "./theme.svelte.js";

export * from "./components/ui/index.js";
export * from "./components/prompt-kit/index.js";
