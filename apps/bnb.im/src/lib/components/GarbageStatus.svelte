<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		status,
		message,
		children
	}: {
		status: number;
		message: string;
		/** where to go from here, set under the message */
		children?: Snippet;
	} = $props();
</script>

<!-- The error and 404 pages: the status has fallen off its sign into a heap.
     The digits are real text, but as inline blocks they'd be named "4 0 4",
     so the heading carries the status as its name. -->
<section class="garbage">
	<p class="kicker">Selected garbage</p>
	<h1 aria-label={String(status)}>{#each String(status) as digit, i (i)}<span class="digit">{digit}</span>{/each}</h1>
	<p class="message">{message}</p>
	{#if children}<p class="next">{@render children()}</p>{/if}
</section>

<style>
	.garbage {
		padding: 2.5rem 0 3rem;
	}

	h1 {
		display: flex;
		align-items: flex-end;
		margin: 0 0 2rem;
		padding: 0.25em 0 0 0.1em;
		border-bottom: var(--rule) solid var(--ink);
		font-family: var(--display);
		font-weight: 400;
		font-size: clamp(6rem, 22cqi, 13rem);
		line-height: 0.74;
	}

	/* each digit lands differently, resting on the floor (the rule): leaning
	   on a corner, flat on its side, upside down against its neighbour */
	.digit {
		display: inline-block;
		color: var(--accent);
		/* 0.035em: thick enough that axe judges the ink stroke, not the fill */
		-webkit-text-stroke: 0.035em var(--ink);
		paint-order: stroke fill;
		animation: fall 0.6s cubic-bezier(0.5, 0, 0.75, 0) both;
	}

	.digit:nth-child(3n + 1) {
		transform-origin: 0 100%;
		translate: 0 0.11em;
		rotate: -12deg;
	}

	.digit:nth-child(3n + 2) {
		margin-left: 0.03em;
		translate: 0 0.06em;
		rotate: 90deg;
		color: var(--highlight);
		animation-delay: 0.12s;
	}

	.digit:nth-child(3n + 3) {
		margin-left: 0.04em;
		translate: 0 -0.02em;
		rotate: 164deg;
		animation-delay: 0.22s;
	}

	@keyframes fall {
		from {
			translate: 0 -120%;
			rotate: 0deg;
		}
	}

	.message {
		max-width: 36rem;
		margin: 0 0 1rem;
		font-size: 1.3rem;
		font-weight: 500;
		line-height: 1.45;
	}

	.next {
		margin: 0;
		font-family: var(--mono);
		font-size: 0.85rem;
		text-transform: uppercase;
	}

	@media (prefers-reduced-motion: reduce) {
		.digit {
			animation: none;
		}
	}
</style>
