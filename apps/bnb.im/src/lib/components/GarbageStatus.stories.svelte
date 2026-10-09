<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import GarbageStatus from './GarbageStatus.svelte';

	const { Story } = defineMeta({
		title: 'bnb.im/GarbageStatus',
		component: GarbageStatus,
		parameters: { theme: 'bnb' }
	});
</script>

<Story name="Not found">
	{#snippet template()}
		<GarbageStatus status={404} message="There's nothing at this address.">
			<a href="/">Back to the index</a>
		</GarbageStatus>
	{/snippet}
</Story>

<Story name="Error">
	{#snippet template()}
		<GarbageStatus status={500} message="Something went sideways.">
			<a href="/">Back to the index</a>
		</GarbageStatus>
	{/snippet}
</Story>
