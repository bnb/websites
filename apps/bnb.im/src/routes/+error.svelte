<script lang="ts">
	import { page } from '$app/state';
	import GarbageStatus from '$lib/components/GarbageStatus.svelte';
	import { SITE_TITLE } from '$lib/site';
</script>

<svelte:head><title>{page.status} · {SITE_TITLE}</title></svelte:head>

<GarbageStatus status={page.status} message={page.error?.message ?? 'Something went sideways.'}>
	<a href="/">Back to the index</a>
</GarbageStatus>
