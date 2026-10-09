<script lang="ts">
	import { Fact, Facts, HeadTags, Seo } from '@bnb/ui';
	import Comments from '$lib/components/Comments.svelte';
	import Subscribe from '$lib/components/Subscribe.svelte';
	import Upvote from '$lib/components/Upvote.svelte';
	import { SITE_URL, TWITTER_CREATOR } from '$lib/site';
	import { WIDTH, HEIGHT } from '$lib/social-size';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<Seo
	title={data.title}
	description={data.description}
	url="{SITE_URL}{data.url}"
	image="{SITE_URL}/img/social/{data.slug}.png"
	imageWidth={WIDTH}
	imageHeight={HEIGHT}
	twitterImage
	twitterCard="summary_large_image"
	twitterCreator={TWITTER_CREATOR}
/>

<HeadTags tags={data.postTags} />

<!-- fills as the page scrolls; CSS only, so it's hidden where scroll-driven
     animations aren't supported or motion is reduced -->
<div class="progress" aria-hidden="true"></div>

<article class="post">
	<a href="/" class="back">← Index</a>
	<h1 class="post-title">{@html data.titleHtml}</h1>
	<div class="meta">
		<Facts variant="strip">
			<Fact term="Date"><time datetime={data.date}>{data.dotDate}</time></Fact>
			<Fact term="Read">{data.readingTime} min</Fact>
			{#if data.topic}
				<Fact term="Topic">{data.topic}</Fact>
			{/if}
			{#if data.series}
				<Fact term="Series"><a href={data.series.url}>{data.series.label}</a></Fact>
			{/if}
			{#if data.tags.length}
				<Fact term="Tags">{#each data.tags as tag (tag)}#{tag}{' '}{/each}</Fact>
			{/if}
		</Facts>
	</div>
	<div class="prose">
		{@html data.html}
	</div>
	{#if data.discussion}
		<Upvote subject={data.discussion.subject} />
	{/if}
	<Subscribe {...data.subscribe} />
	{#if data.discussion}
		<Comments subject={data.discussion.subject} hide={data.discussion.hide} />
		<!-- the upvote button and the comments -->
		<script type="module" src={data.discussion.script}></script>
	{/if}
</article>

<style>
	/* app.css sets footnotes in the margin when the post is wide enough */
	.post {
		container: post / inline-size;
	}

	.meta {
		margin: 0 0 2.5rem;
	}

	.progress {
		display: none;
	}

	@supports (animation-timeline: scroll()) {
		@media (prefers-reduced-motion: no-preference) {
			.progress {
				display: block;
				position: fixed;
				/* beside the site rail, which would otherwise cover its start */
				inset: 0 0 auto var(--rail-width, 0px);
				z-index: 100;
				height: 0.5rem;
				border-bottom: var(--rule) solid var(--ink);
				background: var(--accent);
				transform-origin: 0 50%;
				animation: progress linear both;
				animation-timeline: scroll(root);
			}
		}
	}

	@keyframes progress {
		from {
			transform: scaleX(0);
		}
	}
</style>
