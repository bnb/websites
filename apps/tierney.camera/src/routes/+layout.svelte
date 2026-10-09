<script lang="ts">
	// Self-hosted fonts (no render-blocking external requests): Archivo with its
	// width axis for the wide display type, IBM Plex Mono for captions.
	import '@fontsource-variable/archivo/wdth.css';
	import '@fontsource/ibm-plex-mono/400.css';
	import '@fontsource/ibm-plex-mono/500.css';
	// the rail's preview of bnb.im (a face only downloads once it shows)
	import '@fontsource/archivo-black/400.css';
	import '@fontsource/space-grotesk/700.css';
	import '@fontsource/dm-mono/400.css';
	import '@bnb/ui/base.css';
	import '@bnb/ui/themes/camera.css';
	import '../app.css';
	import { page } from '$app/state';
	import { ACCOUNT_URI, atTags } from '@bnb/atproto';
	import { HeadTags, SiteRail, SkipLink } from '@bnb/ui';
	import { onMount, type Snippet } from 'svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	// tells the fallback in app.html that the app started (so reveals stay on)
	onMount(() => document.documentElement.classList.add('hydrated'));
</script>

<HeadTags tags={atTags({ me: [ACCOUNT_URI] })} />

<!-- ahead of the rail, so it's still the first stop; only the home page has photographs to skip
     to (not error pages, or the sign-in callback) -->
{#if !page.error && page.route.id === '/'}
	<SkipLink href="#work" label="Skip to photographs" />
{/if}

<SiteRail current="camera" latest={data.latest}>
	{@render children()}
</SiteRail>
