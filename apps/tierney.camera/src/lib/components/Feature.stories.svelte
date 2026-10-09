<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { DEFAULT_PDS } from '../atproto';
	import type { Photo } from '../types';
	import Feature from './Feature.svelte';
	import Ticker from './Ticker.svelte';

	const { Story } = defineMeta({
		title: 'tierney.camera/Feature',
		component: Feature,
		parameters: { theme: 'camera', layout: 'fullscreen' }
	});

	const photo: Photo = {
		uri: 'at://photo/featured',
		cid: 'bafkreidfcru2lodcgegau3gy3fxtaswms3p7v37ioepfj4r7jkvd6bys24',
		width: 2000,
		height: 1333,
		alt: '',
		date: '2026-08-20T16:17:13Z',
		posted: '2026-09-17T12:06:04Z',
		place: '',
		camera: 'Sony α7R IV',
		lens: 'FE 50mm ƒ/1.4 GM',
		focal: '50mm',
		aperture: 'ƒ/1.4',
		shutter: '1/30',
		iso: 'ISO 2000',
		ev: 1.6
	};
</script>

<Story name="Default" args={{ photo, index: 3, pds: DEFAULT_PDS, onopen: () => {} }} />

<Story name="With ticker">
	{#snippet template()}
		<Feature {photo} index={3} pds={DEFAULT_PDS} onopen={() => {}} />
		<Ticker items={['Bushwick', 'Manhattan', 'Sony α7R IV', 'FE 50mm ƒ/1.4 GM', 'ISO 12800']} />
	{/snippet}
</Story>
