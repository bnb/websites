<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { DEFAULT_PDS, DID } from '../atproto';
	import { flyerLayout } from '../layout';
	import type { Photo } from '../types';
	import Gallery from './Gallery.svelte';

	// A few common widths; the rows regroup at every width in between too.
	const viewport = (name: string, width: number, height: number) => ({
		name,
		styles: { width: `${width}px`, height: `${height}px` },
		type: width < 1100 ? ('mobile' as const) : ('desktop' as const)
	});

	const { Story } = defineMeta({
		title: 'tierney.camera/Gallery',
		component: Gallery,
		parameters: {
			theme: 'camera',
			layout: 'fullscreen',
			viewport: {
				options: {
					phone: viewport('Phone', 390, 844),
					tablet: viewport('Tablet', 820, 1180),
					desktop: viewport('Laptop', 1280, 800),
					wide: viewport('Wide', 1920, 1080)
				}
			}
		}
	});

	// Real blob CIDs from the live repository, so the stories render actual photographs.
	const shots: Array<[cid: string, portrait: boolean, place: string, date: string]> = [
		['bafkreid6bsykxd2vr3vrrdzrll44rm7xw6gac2nf7vgun54c5dlkdisbpe', false, 'Bushwick, New York', '2026-07-09T14:00:50Z'],
		['bafkreihauaiw3pi6lwi7yw7dppofr4wav2rxxawmjv5yb5fijfejmmjhou', false, 'Bushwick, New York', '2026-07-09T13:50:53Z'],
		['bafkreibsmb4y4zyo7fdoaxala3lhqj2nga7fqtbe7wcr5k3vfplk3qwxv4', false, '', '2026-07-09T13:52:09Z'],
		['bafkreidfcru2lodcgegau3gy3fxtaswms3p7v37ioepfj4r7jkvd6bys24', false, '', '2026-08-20T16:17:13Z'],
		['bafkreidvkxnemz2ol4zieyperqtzcrnvy3jerctcowcdysum52g5dvdlwy', false, '', '2026-05-02T15:50:31Z'],
		['bafkreihg3kz2rwwf4srasee46nd2rqpbrruywbkrqcsxmhayjywjm42ga4', false, '', '2026-07-30T13:51:14Z'],
		['bafkreia6b54mdh24jw2tvfkko6wipyeuqppm72zolymnp2ympxelx3yuoy', true, 'Bushwick, New York', '2026-07-09T13:30:06Z'],
		['bafkreibxnvy3r4hfrekvawpf5e3izpc4o5u6ietpo3d5wljjxop5w23un4', false, 'Bushwick, New York', '2026-07-09T13:28:47Z'],
		['bafkreidhexnbbjyqweyx2maiyocjl6yw7mqs7dpgzluanvi2loghnewosq', false, 'Bushwick, New York', '2026-07-09T13:30:46Z'],
		['bafkreidkzm7v2typ3766m3qqfzq6yl776hfe72mzcmaqnhgsmtgxhbg6r4', false, 'Manhattan, New York', '2026-07-18T11:22:09Z'],
		['bafkreiequjc5bwmmiu33lfummnzj4elxm3ot3cnwfbvefp3yf3cmc65dz4', true, 'Manhattan, New York', '2026-07-18T10:41:22Z'],
		['bafkreieppkl3ai3l5gn3psl2oc7l23f2xkf77esstgd5uqlcony7edzxb4', false, 'Manhattan, New York', '2026-07-18T13:21:21Z']
	];

	const photos: Photo[] = shots.map(([cid, portrait, place, date]) => ({
		uri: `at://${DID}/social.grain.photo/${cid}`,
		cid,
		width: portrait ? 1333 : 2000,
		height: portrait ? 2000 : 1333,
		alt: '',
		date,
		posted: date,
		place,
		camera: 'Sony α7R IV',
		lens: 'FE 50mm ƒ/1.4 GM',
		focal: '50mm',
		aperture: 'ƒ/1.4',
		shutter: '1/60',
		iso: 'ISO 6400',
		ev: 0.9
	}));

	const { tiles } = flyerLayout(photos, photos[3].cid);
	const args = { photos, tiles, pds: DEFAULT_PDS, range: 'May – Aug 2026', onselect: () => {} };
</script>

<!-- The same photographs regroup into different rows at every width; drag the
     canvas edge to watch them reflow, or pick a width from the viewport toolbar. -->
<Story name="Phone" {args} globals={{ viewport: { value: 'phone' } }} />

<Story name="Tablet" {args} globals={{ viewport: { value: 'tablet' } }} />

<Story name="Desktop" {args} globals={{ viewport: { value: 'desktop' } }} />

<Story name="Wide" {args} globals={{ viewport: { value: 'wide' } }} />
