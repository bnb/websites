<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { DEFAULT_PDS } from '../atproto';
	import type { Photo, Swatch } from '../types';
	import PhotoFigure from './PhotoFigure.svelte';

	const { Story } = defineMeta({
		title: 'tierney.camera/PhotoFigure',
		component: PhotoFigure,
		parameters: { theme: 'camera', layout: 'fullscreen' }
	});

	// Real blob CIDs from the live repository, so the stories render actual photographs.
	const photo: Photo = {
		uri: 'at://photo/landscape',
		cid: 'bafkreid6bsykxd2vr3vrrdzrll44rm7xw6gac2nf7vgun54c5dlkdisbpe',
		width: 2000,
		height: 1333,
		alt: '',
		date: '2026-07-09T14:00:50Z',
		posted: '2026-09-17T00:00:00Z',
		place: 'Bushwick, New York',
		camera: 'Sony α7R IV',
		lens: 'FE 50mm ƒ/1.4 GM',
		focal: '50mm',
		aperture: 'ƒ/2.2',
		shutter: '1/80',
		iso: 'ISO 12800',
		ev: 1.6
	};

	const portrait: Photo = {
		...photo,
		uri: 'at://photo/portrait',
		cid: 'bafkreia6b54mdh24jw2tvfkko6wipyeuqppm72zolymnp2ympxelx3yuoy',
		width: 1333,
		height: 2000,
		aperture: 'ƒ/4.5',
		shutter: '1/250',
		ev: 5.3
	};

	// palettes as the server reads them from these photographs' thumbnails
	const palette: Swatch[] = [
		{ hex: '#5c4e42', share: 0.23 },
		{ hex: '#f35d53', share: 0.14 },
		{ hex: '#9b8b6c', share: 0.26 },
		{ hex: '#d1b189', share: 0.25 },
		{ hex: '#e9dacb', share: 0.12 }
	];
	const portraitPalette: Swatch[] = [
		{ hex: '#0b041a', share: 0.49 },
		{ hex: '#0f0a4a', share: 0.19 },
		{ hex: '#440514', share: 0.1 },
		{ hex: '#251f8c', share: 0.16 },
		{ hex: '#6361e1', share: 0.07 }
	];

	const noExif: Photo = {
		...photo,
		uri: 'at://photo/no-exif',
		place: '',
		camera: '',
		lens: '',
		focal: '',
		aperture: '',
		shutter: '',
		iso: '',
		ev: null
	};
</script>

<!-- PhotoFigure is a flex item in the gallery's justified rows, so stories render it in one.
     The Gallery stories show the rows regrouping across widths. -->
<Story name="Justified row (landscape + portrait)">
	{#snippet template()}
		<div class="row">
			<PhotoFigure {photo} index={0} pds={DEFAULT_PDS} {palette} priority onopen={() => {}} />
			<PhotoFigure
				photo={portrait}
				index={6}
				pds={DEFAULT_PDS}
				palette={portraitPalette}
				priority
				onopen={() => {}}
			/>
		</div>
	{/snippet}
</Story>

<Story name="Feature frame (full width)">
	{#snippet template()}
		<div class="row">
			<PhotoFigure {photo} index={7} pds={DEFAULT_PDS} {palette} feature priority onopen={() => {}} />
		</div>
	{/snippet}
</Story>

<Story name="Compact caption (narrow figure)">
	{#snippet template()}
		<div class="row narrow">
			<PhotoFigure {photo} index={2} pds={DEFAULT_PDS} priority onopen={() => {}} />
		</div>
	{/snippet}
</Story>

<!-- before the server has read its colours: the strip keeps its room, empty -->
<Story name="No location / no EXIF">
	{#snippet template()}
		<div class="row">
			<PhotoFigure photo={noExif} index={4} pds={DEFAULT_PDS} priority onopen={() => {}} />
		</div>
	{/snippet}
</Story>

<style>
	.row {
		--row-h: 320px;
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		align-items: flex-start;
		gap: 32px 16px;
		padding: 24px;
		background: var(--bg);
	}
	.narrow {
		--row-h: 160px;
		--grow-max: 1;
	}
</style>
