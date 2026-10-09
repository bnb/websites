<script lang="ts">
	let {
		subject,
		hide = ''
	}: {
		/** the post's site.standard.document record */
		subject: string;
		/** comments (at:// URIs) and accounts (DIDs) to leave out, space-separated */
		hide?: string;
	} = $props();
</script>

<!-- Comments on the post, written with upvote.at's at.upvote.comment records.
     The list is standard.site's web component (the post page loads its
     script): it renders into the light DOM (so these styles apply), and shows
     the ghost lines inside it while it loads. Without JavaScript there's a note
     instead, and no ghost. -->
<section class="comments" id="comments" aria-labelledby="comments-title">
	<h2 id="comments-title">Comments</h2>
	<noscript>
		<p>Comments need JavaScript.</p>
		<style>
			.comments .ghost {
				display: none;
			}
		</style>
	</noscript>
	<standard-site-comments {subject} hide={hide || undefined}>
		<div class="ghost" aria-hidden="true"><span></span><span></span><span></span></div>
	</standard-site-comments>
</section>

<style>
	.comments {
		max-width: 40rem;
		margin: 0 0 4rem;
		padding-top: 1.2rem;
		border-top: var(--rule) solid var(--ink);
	}

	h2 {
		margin: 0 0 1.2rem;
		font-family: var(--display);
		font-weight: 400;
		font-size: 1.6rem;
		text-transform: uppercase;
	}

	/* three lines the height of a short comment, so nothing jumps when it arrives */
	.ghost {
		display: grid;
		gap: 0.6rem;
		padding: 1rem;
		border: var(--rule) solid var(--ink);
	}

	.ghost span {
		height: 0.9rem;
		background: #e6e6e6;
	}

	.ghost span:nth-child(1) {
		width: 30%;
	}

	.ghost span:nth-child(2) {
		width: 90%;
	}

	.ghost span:nth-child(3) {
		width: 65%;
	}

	@media (prefers-reduced-motion: no-preference) {
		.ghost span {
			animation: ghost 1.2s ease-in-out infinite alternate;
		}
	}

	@keyframes ghost {
		to {
			background: #f6f6f6;
		}
	}

	.comments :global {
		standard-site-comments {
			display: grid;
			gap: 1.2rem;
		}

		.standard-site-thread {
			display: grid;
			gap: 1rem;
			margin: 0;
			padding: 0;
			list-style: none;
		}

		.standard-site-thread:empty {
			display: none;
		}

		/* a reply sits under what it answers, on a rule */
		.standard-site-comment > .standard-site-replies {
			margin: 1rem 0 0 1rem;
			padding-left: 1rem;
			border-left: var(--rule) solid var(--ink);
		}

		.standard-site-replies {
			display: grid;
			gap: 1rem;
		}

		.standard-site-replies:not(:has(> .standard-site-thread > *, > button, > p)) {
			display: none;
		}

		.standard-site-comment article {
			padding: 0.8rem 1rem;
			border: var(--rule) solid var(--ink);
			background: var(--bg);
			box-shadow: 4px 4px 0 var(--ink);
		}

		.standard-site-comment article:focus {
			outline: var(--rule) solid var(--accent);
			outline-offset: 3px;
		}

		.standard-site-comment header {
			display: flex;
			flex-wrap: wrap;
			gap: 0.25rem 0.75rem;
			font-family: var(--mono);
			font-size: 0.8rem;
		}

		.standard-site-author {
			font-weight: 700;
		}

		.standard-site-comment time {
			color: var(--ink-dim);
		}

		.standard-site-body {
			overflow-wrap: anywhere;
		}

		.standard-site-body > * {
			margin: 0.5rem 0;
		}

		.standard-site-body code {
			font-family: var(--mono);
			font-size: 0.9em;
		}

		.standard-site-body pre {
			overflow-x: auto;
			padding: 0.6rem;
			background: var(--ink);
			color: var(--bg);
		}

		.standard-site-body blockquote {
			margin-left: 0;
			padding-left: 0.8rem;
			border-left: var(--rule) solid var(--accent);
		}

		.standard-site-actions {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 0.5rem;
		}

		standard-site-comments button {
			padding: 0.25rem 0.7rem;
			border: var(--rule) solid var(--ink);
			background: var(--bg);
			color: var(--ink);
			box-shadow: 3px 3px 0 var(--ink);
			font-family: var(--mono);
			font-size: 0.8rem;
			text-transform: uppercase;
			cursor: pointer;
		}

		standard-site-comments button:hover {
			background: var(--highlight);
		}

		standard-site-comments button:disabled {
			cursor: wait;
			opacity: 0.6;
		}

		/* the big ones: posting, and signing in to */
		.standard-site-composer [type='submit'],
		.standard-site-sign-in-button {
			min-height: 2.75rem;
			padding: 0.45rem 1.1rem;
			background: var(--accent);
			box-shadow: 4px 4px 0 var(--ink);
			font-family: var(--body);
			font-size: 1rem;
			font-weight: 700;
			line-height: 1.2;
			text-transform: none;
		}

		.standard-site-composer {
			display: grid;
			gap: 0.5rem;
		}

		.standard-site-comment .standard-site-composer {
			margin-top: 1rem;
		}

		.standard-site-composer label {
			font-family: var(--mono);
			font-size: 0.75rem;
			text-transform: uppercase;
		}

		.standard-site-composer textarea {
			box-sizing: border-box;
			width: 100%;
			min-height: 6rem;
			padding: 0.6rem;
			border: var(--rule) solid var(--ink);
			border-radius: 0;
			background: var(--bg);
			color: var(--ink);
			font: inherit;
			resize: vertical;
		}

		.standard-site-counter {
			margin: 0;
			font-family: var(--mono);
			font-size: 0.8rem;
			color: var(--ink-dim);
		}

		.standard-site-account {
			margin: 0;
			font-family: var(--mono);
			font-size: 0.85rem;
		}

		.standard-site-empty {
			margin: 0;
		}

		standard-site-comments .standard-site-error {
			justify-self: start;
			margin: 0;
			padding: 0.3rem 0.5rem;
			background: var(--ink);
			color: var(--highlight);
			font-weight: 700;
		}

		standard-site-comments .standard-site-error button {
			margin-left: 0.5rem;
		}

		.standard-site-counter:empty,
		standard-site-comments .standard-site-error:empty {
			display: none;
		}

		/* announcements for screen readers: "Comment posted." */
		.standard-site-status {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip-path: inset(50%);
			white-space: nowrap;
		}
	}
</style>
