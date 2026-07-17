<script lang="ts">
	import { cn } from "$lib/utils";

	type Props = {
		class?: string;
		[key: string]: unknown;
	};

	let { class: className, ...rest }: Props = $props();
</script>

<div
	class={cn("h-px w-full shrink-0 scroll-mt-4", className)}
	aria-hidden="true"
	{...rest}
></div>
