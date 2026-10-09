<script lang="ts">
	// Self-hosted (Fontsource) instead of Google Fonts: Archivo Black for display,
	// Space Grotesk for text, DM Mono for labels and code.
	import '@fontsource/archivo-black/400.css';
	import '@fontsource/space-grotesk/400.css';
	import '@fontsource/space-grotesk/500.css';
	import '@fontsource/space-grotesk/700.css';
	import '@fontsource/dm-mono/400.css';
	import '@fontsource/dm-mono/400-italic.css';
	// the rail's previews of the other two sites (a face only downloads once one shows)
	import '@fontsource-variable/archivo/wdth.css';
	import '@fontsource/ibm-plex-mono/400.css';
	import '@bnb/ui/base.css';
	import '@bnb/ui/themes/bnb.css';
	import '../app.css';
	import { page } from '$app/state';
	import { HeadTags, SiteRail, SkipLink } from '@bnb/ui';
	import SiteFooter from '$lib/components/SiteFooter.svelte';
	import SiteHeader from '$lib/components/SiteHeader.svelte';
	import { FEED } from '$lib/site';
	import type { LayoutData } from './$types';
	import type { Snippet } from 'svelte';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();
</script>

<svelte:head>
	<link
		rel="alternate"
		title="Tierney Cyren - Software and Selected Garbage"
		type="application/atom+xml"
		href={FEED.url}
	/>
</svelte:head>

<HeadTags tags={data.atTags} />

<SkipLink href="#main" label="Skip to content" />

<SiteRail current="bnb" latest={data.latest}>
	<SiteHeader home={page.url.pathname === '/'} topics={data.topics} />

	<main class="wrap" id="main">
		{@render children()}
	</main>

	<SiteFooter />
</SiteRail>
