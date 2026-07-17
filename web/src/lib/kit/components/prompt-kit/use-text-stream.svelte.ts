export type Mode = "typewriter" | "fade";

export type UseTextStreamOptions = {
	textStream: string | AsyncIterable<string>;
	speed?: number;
	mode?: Mode;
	onComplete?: () => void;
	fadeDuration?: number;
	segmentDelay?: number;
	characterChunkSize?: number;
	onError?: (error: unknown) => void;
};

export type UseTextStreamResult = {
	readonly displayedText: string;
	readonly isComplete: boolean;
	readonly segments: { text: string; index: number }[];
	getFadeDuration: () => number;
	getSegmentDelay: () => number;
	reset: () => void;
	startStreaming: () => void;
	pause: () => void;
	resume: () => void;
};

type InternalOptions = {
	getTextStream: () => string | AsyncIterable<string>;
	getSpeed?: () => number;
	getMode?: () => Mode;
	getOnComplete?: () => (() => void) | undefined;
	getFadeDuration?: () => number | undefined;
	getSegmentDelay?: () => number | undefined;
	getCharacterChunkSize?: () => number | undefined;
	onError?: (error: unknown) => void;
};

/** Svelte 5 rune-based port of React useTextStream. Call during component init. */
export function useTextStream({
	getTextStream,
	getSpeed = () => 20,
	getMode = () => "typewriter" as Mode,
	getOnComplete = () => undefined,
	getFadeDuration: getFadeDurationOpt = () => undefined,
	getSegmentDelay: getSegmentDelayOpt = () => undefined,
	getCharacterChunkSize = () => undefined,
	onError,
}: InternalOptions): UseTextStreamResult {
	let displayedText = $state("");
	let isComplete = $state(false);
	let segments = $state<{ text: string; index: number }[]>([]);

	let currentIndexRef = 0;
	let animationRef: number | null = null;
	let streamRef: AbortController | null = null;
	let completedRef = false;

	const speedRef = () => getSpeed();
	const modeRef = () => getMode();
	const fadeDurationRef = () => getFadeDurationOpt();
	const segmentDelayRef = () => getSegmentDelayOpt();
	const characterChunkSizeRef = () => getCharacterChunkSize();
	const onCompleteRef = () => getOnComplete();

	function getChunkSize() {
		const chunk = characterChunkSizeRef();
		if (typeof chunk === "number") {
			return Math.max(1, chunk);
		}
		const normalizedSpeed = Math.min(100, Math.max(1, speedRef()));
		if (modeRef() === "typewriter") {
			if (normalizedSpeed < 25) return 1;
			return Math.max(1, Math.round((normalizedSpeed - 25) / 10));
		}
		return 1;
	}

	function getProcessingDelay() {
		const delay = segmentDelayRef();
		if (typeof delay === "number") {
			return Math.max(0, delay);
		}
		const normalizedSpeed = Math.min(100, Math.max(1, speedRef()));
		return Math.max(1, Math.round(100 / Math.sqrt(normalizedSpeed)));
	}

	function getFadeDuration() {
		const fade = fadeDurationRef();
		if (typeof fade === "number") return Math.max(10, fade);
		const normalizedSpeed = Math.min(100, Math.max(1, speedRef()));
		return Math.round(1000 / Math.sqrt(normalizedSpeed));
	}

	function getSegmentDelay() {
		const delay = segmentDelayRef();
		if (typeof delay === "number") return Math.max(0, delay);
		const normalizedSpeed = Math.min(100, Math.max(1, speedRef()));
		return Math.max(1, Math.round(100 / Math.sqrt(normalizedSpeed)));
	}

	function updateSegments(text: string) {
		if (modeRef() !== "fade") return;
		try {
			const segmenter = new Intl.Segmenter(navigator.language, {
				granularity: "word",
			});
			const segmentIterator = segmenter.segment(text);
			segments = Array.from(segmentIterator).map((segment, index) => ({
				text: segment.segment,
				index,
			}));
		} catch (error) {
			segments = text
				.split(/(\s+)/)
				.filter(Boolean)
				.map((word, index) => ({ text: word, index }));
			onError?.(error);
		}
	}

	function markComplete() {
		if (!completedRef) {
			completedRef = true;
			isComplete = true;
			onCompleteRef()?.();
		}
	}

	function reset() {
		currentIndexRef = 0;
		displayedText = "";
		segments = [];
		isComplete = false;
		completedRef = false;
		if (animationRef) {
			cancelAnimationFrame(animationRef);
			animationRef = null;
		}
	}

	function processStringTypewriter(text: string) {
		let lastFrameTime = 0;

		const streamContent = (timestamp: number) => {
			const delay = getProcessingDelay();
			if (delay > 0 && timestamp - lastFrameTime < delay) {
				animationRef = requestAnimationFrame(streamContent);
				return;
			}
			lastFrameTime = timestamp;

			if (currentIndexRef >= text.length) {
				markComplete();
				return;
			}

			const chunkSize = getChunkSize();
			const endIndex = Math.min(currentIndexRef + chunkSize, text.length);
			const newDisplayedText = text.slice(0, endIndex);

			displayedText = newDisplayedText;
			if (modeRef() === "fade") {
				updateSegments(newDisplayedText);
			}

			currentIndexRef = endIndex;

			if (endIndex < text.length) {
				animationRef = requestAnimationFrame(streamContent);
			} else {
				markComplete();
			}
		};

		animationRef = requestAnimationFrame(streamContent);
	}

	async function processAsyncIterable(stream: AsyncIterable<string>) {
		const controller = new AbortController();
		streamRef = controller;
		let displayed = "";

		try {
			for await (const chunk of stream) {
				if (controller.signal.aborted) return;
				displayed += chunk;
				displayedText = displayed;
				updateSegments(displayed);
			}
			markComplete();
		} catch (error) {
			console.error("Error processing text stream:", error);
			markComplete();
			onError?.(error);
		}
	}

	function startStreaming() {
		reset();
		const textStream = getTextStream();
		if (typeof textStream === "string") {
			processStringTypewriter(textStream);
		} else if (textStream) {
			void processAsyncIterable(textStream);
		}
	}

	function pause() {
		if (animationRef) {
			cancelAnimationFrame(animationRef);
			animationRef = null;
		}
	}

	function resume() {
		const textStream = getTextStream();
		if (typeof textStream === "string" && !isComplete) {
			processStringTypewriter(textStream);
		}
	}

	$effect(() => {
		// re-run when text stream identity/content changes
		void getTextStream();
		startStreaming();
		return () => {
			if (animationRef) cancelAnimationFrame(animationRef);
			if (streamRef) streamRef.abort();
		};
	});

	return {
		get displayedText() {
			return displayedText;
		},
		get isComplete() {
			return isComplete;
		},
		get segments() {
			return segments;
		},
		getFadeDuration,
		getSegmentDelay,
		reset,
		startStreaming,
		pause,
		resume,
	};
}
