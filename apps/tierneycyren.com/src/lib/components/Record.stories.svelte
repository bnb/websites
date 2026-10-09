<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { MIXES } from '../fixtures';
	import { coverAt } from '../plyr';
	import Record from './Record.svelte';

	// The record in each mix (its cover as the label) and on the error page.
	const { Story } = defineMeta({
		title: 'tierneycyren.com/Record',
		component: Record,
		parameters: { theme: 'dj', layout: 'padded' }
	});
</script>

{#snippet label()}
	<img src={coverAt(MIXES[0].image, 400)} alt="" />
{/snippet}

<Story name="Cued up" args={{ arm: 'rest', children: label, style: 'width: 280px' }} />

<Story name="Playing" args={{ arm: 'down', spinning: true, children: label, style: 'width: 280px' }} />

<Story name="Needle up, no cover" args={{ arm: 'lift', style: 'width: 280px' }} />
