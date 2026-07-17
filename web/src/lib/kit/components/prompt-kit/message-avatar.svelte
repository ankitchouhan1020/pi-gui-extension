<script lang="ts">
	import { Avatar } from "bits-ui";
	import { cn } from "$lib/utils";

	type Props = {
		src: string;
		alt: string;
		fallback?: string;
		delayMs?: number;
		class?: string;
	};

	let {
		src,
		alt,
		fallback,
		delayMs,
		class: className,
	}: Props = $props();
</script>

<Avatar.Root
	class={cn("relative flex size-8 shrink-0 overflow-hidden rounded-full h-8 w-8 shrink-0", className)}
	data-slot="avatar"
>
	<Avatar.Image
		{src}
		{alt}
		data-slot="avatar-image"
		class="aspect-square size-full"
	/>
	{#if fallback}
		<Avatar.Fallback
			data-slot="avatar-fallback"
			class="bg-muted flex size-full items-center justify-center rounded-full"
			style={delayMs != null ? `animation-delay: ${delayMs}ms` : undefined}
		>
			{fallback}
		</Avatar.Fallback>
	{/if}
</Avatar.Root>
