<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Marquee from './Marquee.svelte';

	// The same band on each site, dressed by its theme's --marquee-* tokens.
	// Click it, hover it, or Tab to its checkbox to pause it.
	const { Story } = defineMeta({
		title: 'Shared/Marquee',
		component: Marquee,
		parameters: { layout: 'fullscreen' }
	});
</script>

<Story
	name="bnb.im"
	globals={{ theme: 'bnb' }}
	args={{
		items: ['Software and selected garbage', 'AT Protocol', 'Node.js', 'GitHub Actions', 'npm', 'TC39'],
		separator: ' ✶ ',
		fill: 12,
		label: 'the marquee'
	}}
/>

<Story
	name="tierney.camera"
	globals={{ theme: 'camera' }}
	args={{ items: ['Bushwick', 'Manhattan', 'Sony α7R IV', 'FE 50mm ƒ/1.4 GM', 'ISO 12800'] }}
/>

<Story
	name="tierneycyren.com"
	globals={{ theme: 'dj' }}
	args={{ items: ['girl rave dj', 'Bushwick', 'Techno', 'One shots'], separator: '✕' }}
/>

<Story name="Follows the toolbar" args={{ items: ['One', 'Two', 'Three'] }} />
