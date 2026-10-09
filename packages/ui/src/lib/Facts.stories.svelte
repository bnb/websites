<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Fact from './Fact.svelte';
	import Facts from './Facts.svelte';

	// Label / value pairs: columns for a footer's facts, a ruled strip for a
	// post's meta.
	const { Story } = defineMeta({
		title: 'Shared/Facts',
		component: Facts,
		parameters: { layout: 'padded' }
	});
</script>

<Story name="Columns (tierney.camera footer)" globals={{ theme: 'camera' }}>
	{#snippet template()}
		<Facts>
			<Fact term="Based">New York City</Fact>
			<Fact term="Kit">Sony α7R IV<br />FE 50mm F1.4 GM</Fact>
		</Facts>
	{/snippet}
</Story>

<Story name="Strip (bnb.im post meta)" globals={{ theme: 'bnb' }}>
	{#snippet template()}
		<Facts variant="strip">
			<Fact term="Date"><time datetime="2026-10-02">02.10.2026</time></Fact>
			<Fact term="Read">6 min</Fact>
			<Fact term="Topic">AT Protocol</Fact>
			<Fact term="Series"><a href="/series/esm-in-node-js/">ESM in Node.js 2/3</a></Fact>
			<Fact term="Tags">#atmosphere #beginners</Fact>
		</Facts>
	{/snippet}
</Story>

<Story name="Columns (tierneycyren.com)" globals={{ theme: 'dj' }}>
	{#snippet template()}
		<Facts>
			<Fact term="Based">Bushwick, New York</Fact>
			<Fact term="Mixes">2 on plyr.fm</Fact>
		</Facts>
	{/snippet}
</Story>
