<script lang="ts">
	import { BigName, Marquee } from '@bnb/ui';
	import { FEED, TAGLINE } from '../site';

	let {
		home = false,
		topics = []
	}: {
		/** the home page sets the name huge as its <h1>; elsewhere it's a small link */
		home?: boolean;
		/** post topics, most recently written about first, for the marquee */
		topics?: string[];
	} = $props();
</script>

<header class="site-header">
	<div class="wrap">
		<div class="top">
			<a class="feed" href={FEED.url}>RSS</a>
		</div>
		<div class="name" class:small={!home}>
			{#if home}
				<BigName lines={['Tierney', 'Cyren']} mark="." href="/" />
			{:else}
				<BigName lines={['Tierney Cyren']} mark="." href="/" heading={false} />
			{/if}
		</div>
	</div>
	<!-- 6 items, filled to 12 a run, so the text runs four times like it always has -->
	<Marquee items={[TAGLINE, ...topics]} separator=" ✶ " fill={12} label="the marquee" />
</header>

<style>
	.top {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		align-items: center;
		gap: 0.75rem;
		padding: 0.85rem 0;
		font-family: var(--mono);
		font-size: 0.78rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.feed {
		text-decoration: none;
		border: 2px solid var(--ink);
		padding: 0.12rem 0.55rem;
		background: var(--bg);
		box-shadow: 3px 3px 0 var(--ink);
		transition:
			transform 0.1s,
			box-shadow 0.1s;
	}

	.feed:hover {
		background: var(--accent);
		transform: translate(2px, 2px);
		box-shadow: 1px 1px 0 var(--ink);
	}

	.name {
		--name-margin: 0.75rem 0 1.5rem;
	}

	/* Cross-document view transitions (app.css turns them on and times them):
	   the name morphs between the huge home name and the small one, and the
	   marquee slides to where it sits on the next page. Once either starts to
	   scroll off the top, a scroll-driven animation takes its name away, so it
	   can't fly in from off the page; the page just crossfades. (The name is
	   on by default, since a new page has no scroll timeline yet when it's
	   captured, and it opens at the top anyway.) */
	.name :global(.big-name) {
		view-transition-name: big-name;
		width: fit-content;
	}

	.site-header :global(.marquee) {
		view-transition-name: marquee;
	}

	@supports (animation-timeline: view()) {
		.name :global(.big-name),
		.site-header :global(.marquee) {
			animation: unnamed linear forwards;
			animation-timeline: view();
			animation-range: exit;
		}
	}

	@keyframes unnamed {
		from,
		to {
			view-transition-name: none;
		}
	}

	.small {
		--name-margin: 0.25rem 0 1rem;
		--name-size: clamp(1.8rem, 6vw, 3rem);
		--name-leading: 0.9;
	}

	@media (prefers-reduced-motion: reduce) {
		.feed {
			transition: none;
		}
	}
</style>
