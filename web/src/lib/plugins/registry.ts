/**
 * GUI plugin registry — web analogue of pi-tui custom components.
 *
 * Plugins can register:
 *  - message renderers by role (or customType)
 *  - sidebar slots
 *
 * See docs/extend/plugins.md for how to extend.
 */
import type { Component } from "svelte";
import type { ChatMessage } from "$lib/api";

export type MessageRendererProps = {
  message: ChatMessage;
  text: string;
};

export type GuiPlugin = {
  id: string;
  /** Higher wins when multiple match the same role */
  priority?: number;
  /** Return true if this plugin should render the message */
  match?: (msg: ChatMessage) => boolean;
  /** Svelte component for chat bubbles */
  Message?: Component<MessageRendererProps>;
};

const plugins: GuiPlugin[] = [];

export function registerPlugin(plugin: GuiPlugin) {
  const i = plugins.findIndex((p) => p.id === plugin.id);
  if (i >= 0) plugins[i] = plugin;
  else plugins.push(plugin);
  plugins.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

export function findMessagePlugin(msg: ChatMessage): GuiPlugin | undefined {
  return plugins.find((p) => p.match?.(msg));
}

export function listPlugins() {
  return [...plugins];
}
