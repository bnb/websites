<script lang="ts">
	let {
		title,
		description,
		url,
		canonical,
		type,
		siteName,
		image,
		imageWidth,
		imageHeight,
		twitterCard,
		twitterCreator,
		twitterImage = false
	}: {
		title: string;
		description?: string;
		/** og:url */
		url?: string;
		canonical?: string;
		/** og:type */
		type?: 'website' | 'article' | 'profile';
		siteName?: string;
		/** og:image (absolute) */
		image?: string;
		imageWidth?: number;
		imageHeight?: number;
		twitterCard?: 'summary' | 'summary_large_image';
		twitterCreator?: string;
		/** repeat the image as twitter:image */
		twitterImage?: boolean;
	} = $props();
</script>

<!-- Only the tags a site passes are written, so each keeps its own head. -->
<svelte:head>
	<title>{title}</title>
	{#if description}<meta name="description" content={description} />{/if}
	{#if canonical}<link rel="canonical" href={canonical} />{/if}
	{#if twitterCard}<meta name="twitter:card" content={twitterCard} />{/if}
	{#if twitterCreator}<meta name="twitter:creator" content={twitterCreator} />{/if}
	{#if type}<meta property="og:type" content={type} />{/if}
	{#if siteName}<meta property="og:site_name" content={siteName} />{/if}
	{#if url}<meta property="og:url" content={url} />{/if}
	<meta property="og:title" content={title} />
	{#if description}<meta property="og:description" content={description} />{/if}
	{#if image}
		{#if twitterImage}<meta name="twitter:image" content={image} />{/if}
		<meta property="og:image" content={image} />
		{#if imageWidth && imageHeight}
			<meta property="og:image:width" content={String(imageWidth)} />
			<meta property="og:image:height" content={String(imageHeight)} />
		{/if}
	{/if}
</svelte:head>
