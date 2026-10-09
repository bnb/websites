<script lang="ts">
	// Self-hosted fonts: Archivo (its width axis pulled narrow for the display
	// type) and IBM Plex Mono, the same files tierney.camera uses.
	import '@fontsource-variable/archivo/wdth.css';
	import '@fontsource/ibm-plex-mono/400.css';
	import '@fontsource/ibm-plex-mono/500.css';
	// the rail's preview of bnb.im (a face only downloads once it shows)
	import '@fontsource/archivo-black/400.css';
	import '@fontsource/space-grotesk/700.css';
	import '@fontsource/dm-mono/400.css';
	import '@bnb/ui/base.css';
	import '@bnb/ui/themes/dj.css';
	import '../app.css';
	import { page } from '$app/state';
	import { ACCOUNT_URI, atTags } from '@bnb/atproto';
	import { HeadTags, SiteRail, SkipLink } from '@bnb/ui';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();
</script>

<HeadTags tags={atTags({ me: [ACCOUNT_URI] })} />

<!-- ahead of the rail, so it's still the first stop; error pages have no mixes to skip to -->
{#if !page.error}
	<SkipLink href="#mixes" label="Skip to the mixes" />
{/if}

<SiteRail current="dj" latest={data.latest}>
	{@render children()}
</SiteRail>
