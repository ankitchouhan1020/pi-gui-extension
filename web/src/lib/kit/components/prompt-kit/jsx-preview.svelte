<script lang="ts">
	type Props = {
		jsx: string;
		isStreaming?: boolean;
		class?: string;
		[key: string]: unknown;
	};

	let { jsx, isStreaming = false, class: className, ...rest }: Props = $props();

	function matchJsxTag(code: string) {
		if (code.trim() === "") return null;

		const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)\s*([^>]*?)(\/)?>/;
		const match = code.match(tagRegex);

		if (!match || typeof match.index === "undefined") return null;

		const [fullMatch, tagName, attributes, selfClosing] = match;

		const type = selfClosing
			? "self-closing"
			: fullMatch.startsWith("</")
				? "closing"
				: "opening";

		return {
			tag: fullMatch,
			tagName,
			type,
			attributes: attributes.trim(),
			startIndex: match.index,
			endIndex: match.index + fullMatch.length,
		};
	}

	function completeJsxTag(code: string) {
		const stack: string[] = [];
		let result = "";
		let currentPosition = 0;

		while (currentPosition < code.length) {
			const match = matchJsxTag(code.slice(currentPosition));
			if (!match) break;
			const { tagName, type, endIndex } = match;

			if (type === "opening") {
				stack.push(tagName);
			} else if (type === "closing") {
				stack.pop();
			}

			result += code.slice(currentPosition, currentPosition + endIndex);
			currentPosition += endIndex;
		}

		return (
			result +
			stack
				.reverse()
				.map((tag) => `</${tag}>`)
				.join("")
		);
	}

	/** Convert simple HTML-like JSX to safe-ish HTML for preview. */
	function jsxToHtml(source: string): string {
		return source
			.replace(/\bclassName=/g, "class=")
			.replace(/\bhtmlFor=/g, "for=")
			.replace(/\s+on[A-Z][a-zA-Z]*=\{[^}]*\}/g, "")
			.replace(/\s+on[A-Z][a-zA-Z]*="[^"]*"/g, "")
			.replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
			.replace(/\{`([\s\S]*?)`\}/g, "$1")
			.replace(/\{"([^"]*)"\}/g, "$1")
			.replace(/\{'([^']*)'\}/g, "$1")
			.replace(/\{(\d+(?:\.\d+)?)\}/g, "$1")
			.replace(/<\/?script\b[^>]*>/gi, "");
	}

	const processed = $derived(isStreaming ? completeJsxTag(jsx) : jsx);
	const html = $derived(jsxToHtml(processed));
</script>

<!-- ponytail: HTML subset preview (no jsx runtime). Full JSX execute needs a sandbox. -->
<div class={className} data-jsx-preview {...rest}>
	{@html html}
</div>
