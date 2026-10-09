<script lang="ts">
	import { Seo } from '@bnb/ui';
	import PostTable from '$lib/components/PostTable.svelte';
	import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL, SMALL_CARD, TWITTER_CREATOR } from '$lib/site';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<Seo
	title={SITE_TITLE}
	description={SITE_DESCRIPTION}
	url="{SITE_URL}/"
	image={SMALL_CARD}
	twitterImage
	twitterCard="summary"
	twitterCreator={TWITTER_CREATOR}
/>

<section class="intro">
	<h2>Who?</h2>
	<p>
		I'm Tierney Cyren - Developer Advocate, <mark>open source maintainer</mark>, and JavaScript
		developer. Most recently, I was at Twilio as a Principal Developer Advocate, and prior to that
		I've worked at Microsoft as a Senior Developer Advocate and at NodeSource as a Developer
		Advocate. I do work on JavaScript, including Node.js, Electron, npm, and the OpenJS Foundation.
		Previously, I've worked as a Delegate for Microsoft on TC39.
	</p>
</section>
<section aria-labelledby="writing">
	<h2 id="writing" class="sr-only">Writing</h2>
	<PostTable rows={data.rows} byYear />
</section>

<style>
	.intro {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 2.4fr);
		gap: 2rem;
		padding: 2.25rem 0;
		border-bottom: var(--rule) solid var(--ink);
	}

	.intro h2 {
		margin: 0.35rem 0 0;
		font-family: var(--display);
		font-weight: 400;
		font-size: 1rem;
		text-transform: uppercase;
	}

	.intro p {
		margin: 0;
		max-width: 48ch;
		font-size: 1.3rem;
		font-weight: 500;
		line-height: 1.45;
	}

	@media (max-width: 640px) {
		.intro {
			grid-template-columns: 1fr;
			gap: 0.75rem;
		}

		.intro p {
			font-size: 1.15rem;
		}
	}
</style>
