<script lang="ts">
	import { Seo } from '@bnb/ui';
	import PostTable from '$lib/components/PostTable.svelte';
	import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL, SMALL_CARD, TWITTER_CREATOR } from '$lib/site';
	import { page } from '$app/state';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<!-- Series pages have always used the site's own title and card. -->
<Seo
	title={SITE_TITLE}
	description={SITE_DESCRIPTION}
	url="{SITE_URL}{page.url.pathname}"
	image={SMALL_CARD}
	twitterImage
	twitterCard="summary"
	twitterCreator={TWITTER_CREATOR}
/>

<section class="series">
	<a href="/" class="back">← Index</a>
	<p class="kicker">A series in {data.rows.length} parts</p>
	<h1 class="post-title">{data.title}</h1>
	<p class="lede">{data.description}</p>
	<PostTable rows={data.rows} numberLabel="Part" topics={false} />
</section>
