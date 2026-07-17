<script lang="ts">
	import type { Snippet } from "svelte";
	import { setFileUploadContext } from "./file-upload-context.js";

	type Props = {
		onFilesAdded: (files: File[]) => void;
		children?: Snippet;
		multiple?: boolean;
		accept?: string;
		disabled?: boolean;
	};

	let {
		onFilesAdded,
		children,
		multiple = true,
		accept,
		disabled = false,
	}: Props = $props();

	let inputEl = $state<HTMLInputElement | null>(null);
	let isDragging = $state(false);
	let dragCounter = 0;

	function handleFiles(files: FileList) {
		const newFiles = Array.from(files);
		if (multiple) {
			onFilesAdded(newFiles);
		} else {
			onFilesAdded(newFiles.slice(0, 1));
		}
	}

	function openFileDialog() {
		if (disabled) return;
		inputEl?.click();
	}

	function handleFileSelect(e: Event) {
		if (disabled) return;
		const target = e.currentTarget as HTMLInputElement;
		if (target.files?.length) {
			handleFiles(target.files);
			target.value = "";
		}
	}

	$effect(() => {
		// Track prop so listeners refresh when disabled flips.
		const isDisabled = disabled;

		const handleDrag = (e: DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
		};

		const handleDragIn = (e: DragEvent) => {
			handleDrag(e);
			if (isDisabled) return;
			dragCounter++;
			if (e.dataTransfer?.items.length) isDragging = true;
		};

		const handleDragOut = (e: DragEvent) => {
			handleDrag(e);
			if (isDisabled) return;
			dragCounter--;
			if (dragCounter === 0) isDragging = false;
		};

		const handleDrop = (e: DragEvent) => {
			handleDrag(e);
			isDragging = false;
			dragCounter = 0;
			if (isDisabled) return;
			if (e.dataTransfer?.files.length) {
				handleFiles(e.dataTransfer.files);
			}
		};

		window.addEventListener("dragenter", handleDragIn);
		window.addEventListener("dragleave", handleDragOut);
		window.addEventListener("dragover", handleDrag);
		window.addEventListener("drop", handleDrop);

		return () => {
			window.removeEventListener("dragenter", handleDragIn);
			window.removeEventListener("dragleave", handleDragOut);
			window.removeEventListener("dragover", handleDrag);
			window.removeEventListener("drop", handleDrop);
		};
	});

	setFileUploadContext({
		get isDragging() {
			return isDragging;
		},
		openFileDialog,
		get multiple() {
			return multiple;
		},
		get disabled() {
			return disabled;
		},
	});
</script>

<input
	type="file"
	bind:this={inputEl}
	onchange={handleFileSelect}
	class="hidden"
	{multiple}
	{accept}
	aria-hidden="true"
	{disabled}
/>
{@render children?.()}
