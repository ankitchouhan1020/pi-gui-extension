import { getContext, setContext } from "svelte";

const KEY = Symbol("reasoning");

export type ReasoningContext = {
	readonly isOpen: boolean;
	onOpenChange: (open: boolean) => void;
};

export function setReasoningContext(ctx: ReasoningContext) {
	setContext(KEY, ctx);
}

export function getReasoningContext(): ReasoningContext {
	const ctx = getContext<ReasoningContext | undefined>(KEY);
	if (!ctx) {
		throw new Error(
			"useReasoningContext must be used within a Reasoning provider"
		);
	}
	return ctx;
}
