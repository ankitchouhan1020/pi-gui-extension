/**
 * Sync Shiki highlighter for chat markdown (dual light/dark themes).
 * Languages are explicit imports so unused ones stay tree-shaken.
 */
import {
	escapeHtml,
	type ShikiHighlighter,
} from "@humanspeak/svelte-markdown/extensions/shiki";
import { createHighlighterCoreSync } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

import bash from "shiki/langs/bash.mjs";
import css from "shiki/langs/css.mjs";
import diff from "shiki/langs/diff.mjs";
import go from "shiki/langs/go.mjs";
import html from "shiki/langs/html.mjs";
import java from "shiki/langs/java.mjs";
import javascript from "shiki/langs/javascript.mjs";
import json from "shiki/langs/json.mjs";
import jsx from "shiki/langs/jsx.mjs";
import markdown from "shiki/langs/markdown.mjs";
import python from "shiki/langs/python.mjs";
import rust from "shiki/langs/rust.mjs";
import shellscript from "shiki/langs/shellscript.mjs";
import sql from "shiki/langs/sql.mjs";
import svelte from "shiki/langs/svelte.mjs";
import toml from "shiki/langs/toml.mjs";
import tsx from "shiki/langs/tsx.mjs";
import typescript from "shiki/langs/typescript.mjs";
import yaml from "shiki/langs/yaml.mjs";

import githubDark from "shiki/themes/github-dark.mjs";
import githubLight from "shiki/themes/github-light.mjs";

const core = createHighlighterCoreSync({
	engine: createJavaScriptRegexEngine(),
	langs: [
		bash,
		css,
		diff,
		go,
		html,
		java,
		javascript,
		json,
		jsx,
		markdown,
		python,
		rust,
		shellscript,
		sql,
		svelte,
		toml,
		tsx,
		typescript,
		yaml,
	],
	themes: [githubLight, githubDark],
});

const loadedLangs = new Set(core.getLoadedLanguages());

function fallback(code: string, lang: string): string {
	const langAttr = lang ? ` data-lang="${escapeHtml(lang)}"` : "";
	return `<pre class="shiki-fallback"${langAttr}><code>${escapeHtml(code)}</code></pre>`;
}

/** Dual-theme highlighter (CSS vars; see markdown.svelte). */
export const mdHighlighter: ShikiHighlighter = {
	hasLang: (lang) => loadedLangs.has(lang),
	highlight(code, lang) {
		if (!lang || !loadedLangs.has(lang)) return fallback(code, lang);
		try {
			return core.codeToHtml(code, {
				lang,
				themes: { light: "github-light", dark: "github-dark" },
				defaultColor: false,
			});
		} catch {
			return fallback(code, lang);
		}
	},
};

/**
 * Highlight a single line → inner HTML (no &lt;pre&gt;).
 * For diff rows / inline use. Falls back to escaped plain text.
 */
export function highlightInline(code: string, lang: string): string {
	if (!code) return "";
	if (!lang || !loadedLangs.has(lang)) return escapeHtml(code);
	try {
		const html = core.codeToHtml(code, {
			lang,
			themes: { light: "github-light", dark: "github-dark" },
			defaultColor: false,
		});
		const m = html.match(/<code[^>]*>([\s\S]*)<\/code>/);
		return m ? m[1] : escapeHtml(code);
	} catch {
		return escapeHtml(code);
	}
}

/** Map file path → shiki lang id (only langs we load). */
export function langFromPath(path: string): string {
	const base = path.split(/[/\\]/).pop() ?? path;
	const lower = base.toLowerCase();
	if (lower === "dockerfile") return "bash";
	const ext = lower.includes(".") ? lower.slice(lower.lastIndexOf(".") + 1) : "";
	const map: Record<string, string> = {
		ts: "typescript",
		mts: "typescript",
		cts: "typescript",
		tsx: "tsx",
		js: "javascript",
		mjs: "javascript",
		cjs: "javascript",
		jsx: "jsx",
		json: "json",
		jsonc: "json",
		css: "css",
		html: "html",
		htm: "html",
		svelte: "svelte",
		py: "python",
		rs: "rust",
		go: "go",
		java: "java",
		md: "markdown",
		markdown: "markdown",
		yml: "yaml",
		yaml: "yaml",
		toml: "toml",
		sql: "sql",
		sh: "shellscript",
		bash: "bash",
		zsh: "shellscript",
		diff: "diff",
		patch: "diff",
	};
	const lang = map[ext] ?? "";
	return lang && loadedLangs.has(lang) ? lang : "";
}
