<script lang="ts">
	let { publication, script }: { publication: string; script: string } = $props();
</script>

<!-- The end-of-post subscribe box. The button is standard.site's web component:
     it renders into the light DOM (so these styles apply) and writes a
     subscription record to the reader's own repository. Its script is the
     only JavaScript on the site. -->
<aside class="subscribe">
	<h2>Want more garbage?</h2>
	<p>Follow new posts as they land.</p>
	<standard-site-subscribe {publication}></standard-site-subscribe>
	<script type="module" src={script}></script>
</aside>

<style>
	.subscribe {
		max-width: 40rem;
		margin: 3rem 0 4rem;
		padding: 1.4rem;
		border: var(--rule) solid var(--ink);
		background: var(--highlight);
		box-shadow: 8px 8px 0 var(--ink);
	}

	h2 {
		margin: 0 0 0.25rem;
		font-family: var(--display);
		font-weight: 400;
		font-size: 1.4rem;
		text-transform: uppercase;
	}

	p {
		margin: 0 0 1rem;
	}

	standard-site-subscribe {
		display: block;
	}

	.subscribe :global {
		standard-site-subscribe button {
			/* the same height as the upvote and comment buttons beside it */
			min-height: 2.75rem;
			padding: 0.45rem 1.1rem;
			border: var(--rule) solid var(--ink);
			background: var(--accent);
			color: var(--ink);
			box-shadow: 4px 4px 0 var(--ink);
			font: inherit;
			font-weight: 700;
			line-height: 1.2;
			cursor: pointer;
			transition:
				transform 0.1s,
				box-shadow 0.1s;
		}

		standard-site-subscribe button:hover {
			transform: translate(2px, 2px);
			box-shadow: 2px 2px 0 var(--ink);
		}

		standard-site-subscribe button:disabled {
			opacity: 0.6;
			cursor: wait;
			transform: none;
		}

		standard-site-subscribe [data-action='cancel'],
		standard-site-subscribe [data-action='unsubscribe'] {
			background: var(--bg);
		}

		.standard-site-subscribe-form {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 0.6rem;
		}

		.standard-site-subscribe-form label {
			width: 100%;
			font-family: var(--mono);
			font-size: 0.75rem;
			text-transform: uppercase;
		}

		.standard-site-subscribe-form input {
			flex: 1 1 12rem;
			min-width: 0;
			padding: 0.45rem 0.6rem;
			border: var(--rule) solid var(--ink);
			border-radius: 0;
			background: var(--bg);
			color: var(--ink);
			font: inherit;
		}

		.standard-site-subscribe-hint {
			margin: 0.75rem 0 0;
			font-size: 0.9rem;
		}

		.standard-site-subscribe-status {
			margin: 0 0 0.75rem;
			font-weight: 700;
		}

		.standard-site-subscribe-error {
			display: inline-block;
			margin: 0.75rem 0 0;
			padding: 0.3rem 0.5rem;
			background: var(--ink);
			color: var(--highlight);
			font-weight: 700;
		}
	}
</style>
