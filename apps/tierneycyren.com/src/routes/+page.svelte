<script lang="ts">
	import { ACCOUNT_URI, atTags } from '@bnb/atproto';
	import { HeadTags, Marquee, Seo } from '@bnb/ui';
	import Masthead from '$lib/components/Masthead.svelte';
	import MixList from '$lib/components/MixList.svelte';
	import NowPlaying from '$lib/components/NowPlaying.svelte';
	import SiteFooter from '$lib/components/SiteFooter.svelte';
	import Spectrum from '$lib/components/Spectrum.svelte';
	import { marqueeItems, mixSummary } from '$lib/format';
	import { player, toggle } from '$lib/player.svelte';
	import { FALLBACK_BIO, NAME, PLYR_PROFILE, SITE_NAME, SITE_URL } from '$lib/site';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const bio = $derived(data.bio || FALLBACK_BIO);
	// the generated share card (routes/og.png), versioned by the newest mix so
	// social apps fetch a fresh one when a mix goes up
	const card = $derived.by(() => {
		const newest = data.mixes[0]?.uri.split('/').at(-1);
		return `${SITE_URL}/og.png${newest ? `?v=${newest}` : ''}`;
	});
	// the plyr.fm records on the page: the profile, if there is one, and every mix
	const records = $derived(
		atTags({
			alternate: [...(data.profile ? [data.profile] : []), ...data.mixes.map((mix) => mix.uri)],
			author: [ACCOUNT_URI]
		})
	);
</script>

<Seo
	title="{NAME} · dj"
	description={bio}
	canonical="{SITE_URL}/"
	type="profile"
	siteName={SITE_NAME}
	url="{SITE_URL}/"
	image={card}
	imageWidth={1200}
	imageHeight={630}
	twitterCard="summary_large_image"
/>

<HeadTags tags={records} />

<svelte:head>
	<link rel="me" href={PLYR_PROFILE} />
</svelte:head>

<main id="top">
	<Masthead bio={data.bio} />
	<Marquee items={marqueeItems(bio, data.mixes)} separator="✕" />
	<Spectrum />
	<MixList mixes={data.mixes} loadError={data.loadError} />
</main>

<SiteFooter mixes={mixSummary(data.mixes)} />

<NowPlaying
	mix={player.mix}
	playing={player.playing}
	time={player.time}
	duration={player.duration}
	ontoggle={() => toggle()}
/>
