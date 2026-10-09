<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { DEFAULT_PDS } from '../atproto';
	import type { Photo, Swatch } from '../types';
	import Lightbox from './Lightbox.svelte';

	const { Story } = defineMeta({
		title: 'tierney.camera/Lightbox',
		component: Lightbox,
		parameters: { theme: 'camera', layout: 'fullscreen' }
	});

	// Real blob CIDs from the live repository.
	const photos: Photo[] = [
		{
			uri: 'at://photo/1',
			cid: 'bafkreid6bsykxd2vr3vrrdzrll44rm7xw6gac2nf7vgun54c5dlkdisbpe',
			width: 2000,
			height: 1333,
			alt: '',
			date: '2026-08-20T16:17:13Z',
			posted: '2026-09-17T00:00:00Z',
			place: 'Bushwick, New York',
			camera: 'Sony α7R IV',
			lens: 'FE 50mm ƒ/1.4 GM',
			focal: '50mm',
			aperture: 'ƒ/1.4',
			shutter: '1/30',
			iso: 'ISO 2000',
			ev: 1.6
		},
		{
			uri: 'at://photo/2',
			cid: 'bafkreihauaiw3pi6lwi7yw7dppofr4wav2rxxawmjv5yb5fijfejmmjhou',
			width: 2000,
			height: 1333,
			alt: '',
			date: '2026-07-09T14:00:50Z',
			posted: '2026-09-10T00:00:00Z',
			place: 'Bushwick, New York',
			camera: 'Sony α7R IV',
			lens: 'FE 50mm ƒ/1.4 GM',
			focal: '50mm',
			aperture: 'ƒ/2.2',
			shutter: '1/80',
			iso: 'ISO 12800',
			ev: 1.6
		}
	];

	// as the server reads them from the thumbnails; the second photograph's isn't ready yet
	const palettes: Record<string, Swatch[]> = {
		[photos[0].cid]: [
			{ hex: '#5c4e42', share: 0.23 },
			{ hex: '#f35d53', share: 0.14 },
			{ hex: '#9b8b6c', share: 0.26 },
			{ hex: '#d1b189', share: 0.25 },
			{ hex: '#e9dacb', share: 0.12 }
		]
	};
</script>

<Story
	name="Open"
	args={{ photos, pds: DEFAULT_PDS, index: 0, palettes, onclose: () => {}, onnav: () => {} }}
/>

<!-- no shutter speed in the EXIF, so nothing for the light meter to read -->
<Story
	name="Without a light reading"
	args={{
		photos: [{ ...photos[1], shutter: '', ev: null }],
		pds: DEFAULT_PDS,
		index: 0,
		onclose: () => {},
		onnav: () => {}
	}}
/>
