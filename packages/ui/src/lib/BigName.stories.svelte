<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import BigName from './BigName.svelte';

	// The name, set as big as the page allows. Each theme sizes it (--name-*);
	// the props decide what takes the accent and how the lines sit.
	const { Story } = defineMeta({
		title: 'Shared/BigName',
		component: BigName,
		parameters: { layout: 'padded' }
	});
</script>

<Story
	name="bnb.im (accented full stop)"
	globals={{ theme: 'bnb' }}
	args={{ lines: ['Tierney', 'Cyren'], mark: '.', href: '/' }}
/>

<Story
	name="bnb.im (small link)"
	globals={{ theme: 'bnb' }}
	args={{ lines: ['Tierney Cyren'], mark: '.', href: '/', heading: false }}
/>

<Story
	name="tierney.camera (split, last line lit)"
	globals={{ theme: 'camera' }}
	args={{ lines: ['tierney', 'cyren'], accent: 'last', split: true }}
/>

<Story
	name="tierneycyren.com"
	globals={{ theme: 'dj' }}
	args={{ lines: ['tierney', 'cyren'], accent: 'last' }}
/>
