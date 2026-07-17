import { getContext, setContext } from "svelte";

const KEY = Symbol("file-upload");

export type FileUploadContext = {
	readonly isDragging: boolean;
	openFileDialog: () => void;
	readonly multiple?: boolean;
	readonly disabled?: boolean;
};

export function setFileUploadContext(ctx: FileUploadContext) {
	setContext(KEY, ctx);
}

export function getFileUploadContext(): FileUploadContext | null {
	return getContext<FileUploadContext | null>(KEY) ?? null;
}
