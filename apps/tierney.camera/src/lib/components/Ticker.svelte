<script lang="ts">
	import { Marquee } from '@bnb/ui';
	import FStop from './FStop.svelte';

	let { items }: { items: string[] } = $props();
</script>

<!-- The shared marquee (pausable, with or without JS), with every ƒ kept
     lowercase. Its text is decorative: the same facts are in the footer. -->
<div class="ticker">
	<Marquee {items}>
		{#snippet item(value)}<FStop text={value} />{/snippet}
	</Marquee>
</div>

<style>
	.ticker {
		margin-top: clamp(40px, 5vw, 72px);
	}
</style>
