<script module lang="ts">
	/** A <meta> tag (AT Tags) or a <link> tag (standard.site's record links). */
	export type HeadTag = { name: string; content: string } | { rel: string; href: string };
</script>

<script lang="ts">
	let { tags }: { tags: HeadTag[] } = $props();
</script>

<!-- AT Tags (https://tangled.org/chrisshank.com/at-tags/) and standard.site link tags -->
<svelte:head>
	{#each tags as tag, i (i)}
		{#if 'rel' in tag}
			<link rel={tag.rel} href={tag.href} />
		{:else}
			<meta name={tag.name} content={tag.content} />
		{/if}
	{/each}
</svelte:head>
