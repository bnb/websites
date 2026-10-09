<script lang="ts">
	import type { Swatch } from '../types';

	// A photograph's dominant colours as one thin bar, each as wide as its share of
	// the frame. Decorative (the photograph itself carries the colours), so it's
	// hidden from assistive tech. It always takes its height, so a palette arriving
	// on a later render never moves anything.
	let { swatches = [] }: { swatches?: Swatch[] } = $props();
</script>

<span class="strip" aria-hidden="true">
	{#each swatches as swatch, i (i)}
		<span style:background={swatch.hex} style:flex-grow={swatch.share}></span>
	{/each}
</span>

<style>
	.strip {
		display: flex;
		width: 100%;
		height: 4px;
	}
	span span {
		flex-basis: 0;
	}
</style>
