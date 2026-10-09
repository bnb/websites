<script lang="ts">
	import { Seo } from '@bnb/ui';
	import GarbageStatus from '$lib/components/GarbageStatus.svelte';
	import { SITE_TITLE } from '$lib/site';
</script>

<Seo title="Not found · {SITE_TITLE}" />
<svelte:head><meta name="robots" content="noindex" /></svelte:head>

<GarbageStatus status={404} message="There's nothing at this address.">
	<a href="/">Back to the index</a>
</GarbageStatus>
