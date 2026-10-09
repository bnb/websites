<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		variant = 'columns',
		children
	}: {
		/** columns: label over value, in as many columns as fit. strip: ruled cells, the first one lit. */
		variant?: 'columns' | 'strip';
		/** <Fact> items */
		children: Snippet;
	} = $props();
</script>

<dl class="facts {variant}">
	{@render children()}
</dl>

<style>
	.facts {
		margin: 0;
	}
	.facts :global(dd) {
		margin: 0;
	}

	.columns {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 32px;
		font-family: var(--mono);
		font-size: 12px;
		text-transform: uppercase;
		/* 24px lines (at 12px mono): stacked links sit far enough apart to meet
		   the WCAG 2.2 minimum target spacing (2.5.8) */
		line-height: 2;
		letter-spacing: 0.06em;
	}
	.columns :global(dt) {
		color: var(--ink-dim);
	}

	/* the gap shows the ink background through, so cells get rules on every
	   side however they wrap */
	.strip {
		display: flex;
		flex-wrap: wrap;
		gap: var(--rule);
		border: var(--rule) solid var(--ink);
		background: var(--ink);
	}
	.strip > :global(div) {
		flex: 1 1 9rem;
		min-width: 0;
		padding: 0.6rem 0.8rem;
		background: var(--bg);
	}
	.strip > :global(div:first-child) {
		background: var(--accent);
	}
	.strip :global(dt) {
		font-family: var(--mono);
		font-size: 0.68rem;
		text-transform: uppercase;
	}
	.strip :global(dd) {
		font-weight: 700;
		overflow-wrap: anywhere;
	}
</style>
