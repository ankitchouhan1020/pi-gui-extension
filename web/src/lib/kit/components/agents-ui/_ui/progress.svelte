<script lang="ts">
	import { cn } from "$lib/utils.js";

	type Props = {
		value?: number | null;
		class?: string;
		max?: number;
	};

	let { value = 0, class: className, max = 100 }: Props = $props();
</script>

<div
	data-slot="progress"
	role="progressbar"
	aria-valuemin={0}
	aria-valuemax={max}
	aria-valuenow={value ?? 0}
	class={cn("relative h-2 w-full overflow-hidden rounded-full bg-secondary", className)}
>
	<div
		class="h-full w-full flex-1 bg-primary transition-all"
		style="transform: translateX(-{100 - (value || 0)}%)"
	></div>
</div>
