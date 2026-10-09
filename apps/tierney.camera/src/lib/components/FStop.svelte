<script lang="ts">
	// `text-transform: uppercase` maps ƒ (U+0192) to its capital Ƒ (U+0191), a
	// hooked F that reads as a typo; this renders text with every ƒ left lowercase.
	let { text }: { text: string } = $props();

	const parts = $derived(text.split('ƒ'));
</script>

{#each parts as part, i (i)}{#if i}<span class="f">ƒ</span>{/if}{part}{/each}

<style>
	.f {
		text-transform: none;
	}
</style>
