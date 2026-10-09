<script lang="ts">
	let { subject }: { subject: string } = $props();
</script>

<!-- The end-of-post upvote. The button is standard.site's web component (the
     post page loads its script, shared with the comments): it renders into the
     light DOM, so these styles apply, and writes an at.upvote.signal record to
     the reader's own repository. Without JavaScript there's nothing to show. -->
<div class="upvote">
	<standard-site-upvote {subject}></standard-site-upvote>
	<noscript>
		<style>
			.upvote {
				display: none;
			}
		</style>
	</noscript>
</div>

<style>
	/* sits 1.5rem above the subscribe box, whose own top margin is 3rem */
	.upvote {
		margin: 3rem 0 -1.5rem;
	}

	.upvote :global {
		standard-site-upvote {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 0.75rem;
			/* the button's height, held before the script draws it */
			min-height: 2.75rem;
		}

		standard-site-upvote button {
			display: inline-flex;
			align-items: center;
			gap: 0.45rem;
			min-height: 2.75rem;
			padding: 0.45rem 1rem;
			border: var(--rule) solid var(--ink);
			background: var(--bg);
			color: var(--ink);
			box-shadow: 4px 4px 0 var(--ink);
			font-family: var(--mono);
			font-size: 0.85rem;
			text-transform: uppercase;
			cursor: pointer;
			transition:
				transform 0.1s,
				box-shadow 0.1s;
		}

		standard-site-upvote button:hover {
			transform: translate(2px, 2px);
			box-shadow: 2px 2px 0 var(--ink);
		}

		standard-site-upvote button[aria-pressed='true'] {
			background: var(--accent);
		}

		.standard-site-count {
			font-weight: 700;
		}

		.standard-site-count:empty {
			display: none;
		}

		standard-site-upvote .standard-site-error {
			margin: 0;
			padding: 0.3rem 0.5rem;
			background: var(--ink);
			color: var(--highlight);
			font-weight: 700;
		}

		standard-site-upvote .standard-site-error:empty {
			display: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.upvote :global(standard-site-upvote button) {
			transition: none;
		}
	}
</style>
