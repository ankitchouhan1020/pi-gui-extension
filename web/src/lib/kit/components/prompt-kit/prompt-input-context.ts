import { getContext, setContext } from "svelte";

const KEY = Symbol("prompt-input");

export type PromptInputContext = {
	readonly isLoading: boolean;
	readonly value: string;
	setValue: (value: string) => void;
	readonly maxHeight: number | string;
	onSubmit?: () => void;
	readonly disabled?: boolean;
};

export function setPromptInputContext(ctx: PromptInputContext) {
	setContext(KEY, ctx);
}

export function getPromptInputContext(): PromptInputContext {
	const ctx = getContext<PromptInputContext | undefined>(KEY);
	if (!ctx) {
		throw new Error("usePromptInput must be used within a PromptInput");
	}
	return ctx;
}
