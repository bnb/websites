<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, userEvent } from 'storybook/test';
	import SkipLink from './SkipLink.svelte';

	// Hidden until it has keyboard focus; the play function tabs to it.
	const { Story } = defineMeta({
		title: 'Shared/SkipLink',
		component: SkipLink,
		args: { href: '#main', label: 'Skip to content' }
	});
</script>

<Story
	name="Focused"
	play={async ({ canvas }) => {
		await userEvent.tab();
		await expect(canvas.getByRole('link', { name: 'Skip to content' })).toHaveFocus();
	}}
/>
