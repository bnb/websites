<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import { HANDLE } from '$lib/atproto';
	import { likes } from '$lib/likes';
	import { kit, monthRange, personName, tickerItems } from '$lib/format';
	import { flyerLayout } from '$lib/layout';
	import { CARD_HEIGHT, CARD_WIDTH, FEATURED_CID, SITE_NAME, SITE_URL } from '$lib/site';
	import Masthead from '$lib/components/Masthead.svelte';
	import Feature from '$lib/components/Feature.svelte';
	import Ticker from '$lib/components/Ticker.svelte';
	import Gallery from '$lib/components/Gallery.svelte';
	import Lightbox from '$lib/components/Lightbox.svelte';
	import SiteFooter from '$lib/components/SiteFooter.svelte';
	import { ACCOUNT_URI, atTags, recordUri } from '@bnb/atproto';
	import { HeadTags, Seo } from '@bnb/ui';

	let { data }: { data: PageData } = $props();

	let lightboxIndex = $state(-1);

	// a returning reader's likes fill in once their session is back; a like they
	// signed in to make is shown where they made it
	onMount(async () => {
		const liked = await likes.restore();
		if (liked) document.querySelector(`[data-like="${CSS.escape(liked)}"]`)?.scrollIntoView({ block: 'center' });
	});

	const open = (index: number) => (lightboxIndex = index);
	const close = () => (lightboxIndex = -1);
	const navigate = (direction: number) => {
		const n = data.photos.length;
		if (n > 0) lightboxIndex = (lightboxIndex + direction + n) % n;
	};

	const layout = $derived(flyerLayout(data.photos, FEATURED_CID));
	const featured = $derived(layout.featured >= 0 ? data.photos[layout.featured] : null);

	const name = $derived(personName(data.profile));
	const bio = $derived((data.profile?.description ?? '').split('\n')[0]);
	const description = $derived(bio || 'Photography, read live from the AT Protocol.');
	// the grain.social records on the page: the profile, if there is one, and every photograph
	const records = $derived(
		atTags({
			alternate: [
				...(data.profile ? [recordUri('social.grain.actor.profile', 'self')] : []),
				...data.photos.map((photo) => photo.uri)
			],
			author: [ACCOUNT_URI]
		})
	);
</script>

<Seo
	title="{name} · photography"
	{description}
	canonical="{SITE_URL}/"
	type="website"
	siteName={SITE_NAME}
	url="{SITE_URL}/"
	image="{SITE_URL}/og.png"
	imageWidth={CARD_WIDTH}
	imageHeight={CARD_HEIGHT}
	twitterCard="summary_large_image"
/>

<HeadTags tags={records} />

<svelte:head>
	<link rel="me" href="https://grain.social/profile/{HANDLE}" />
</svelte:head>

<main id="top">
	<Masthead profile={data.profile} />

	{#if featured}
		<Feature
			photo={featured}
			index={layout.featured}
			pds={data.pds}
			likes={data.likes}
			onopen={() => open(layout.featured)}
		/>
		<Ticker items={tickerItems(data.photos)} />
	{/if}

	<Gallery
		photos={data.photos}
		tiles={layout.tiles}
		pds={data.pds}
		range={monthRange(data.photos)}
		loadError={data.loadError}
		palettes={data.palettes}
		likes={data.likes}
		onselect={open}
	/>
</main>

<SiteFooter {name} kit={kit(data.photos)} />

<Lightbox
	photos={data.photos}
	pds={data.pds}
	index={lightboxIndex}
	palettes={data.palettes}
	likes={data.likes}
	onclose={close}
	onnav={navigate}
/>
