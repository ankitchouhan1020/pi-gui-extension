import { getContext, setContext } from "svelte";

const KEY = Symbol("stick-to-bottom");

export type StickToBottomContext = {
	readonly isAtBottom: boolean;
	scrollToBottom: (behavior?: ScrollBehavior) => void;
};

export function setStickToBottomContext(ctx: StickToBottomContext) {
	setContext(KEY, ctx);
}

export function getStickToBottomContext(): StickToBottomContext {
	const ctx = getContext<StickToBottomContext | undefined>(KEY);
	if (!ctx) {
		throw new Error("ScrollButton must be used within ChatContainerRoot");
	}
	return ctx;
}

export function tryGetStickToBottomContext(): StickToBottomContext | undefined {
	return getContext<StickToBottomContext | undefined>(KEY);
}
