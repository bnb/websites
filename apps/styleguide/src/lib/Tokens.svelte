<script lang="ts">
	// The design tokens every theme defines, shown with their current values.
	// Values are read from the page, so each story shows whichever theme it's in.
	const COLORS = [
		['--bg', 'Page'],
		['--bg-soft', 'Raised surface'],
		['--ink', 'Text'],
		['--ink-dim', 'Secondary text'],
		['--ink-faint', 'Tertiary text'],
		['--accent', 'Accent'],
		['--accent-ink', 'Text on accent'],
		['--highlight', 'Highlight'],
		['--highlight-ink', 'Text on highlight']
	] as const;

	const FACES = [
		['--display', 'Display', 'Software and selected garbage'],
		['--body', 'Body', 'The quick brown fox jumps over the lazy dog.'],
		['--mono', 'Mono', 'ƒ/1.4 · 1/80 · ISO 12800']
	] as const;

	let root = $state<HTMLElement>();
	const values = $derived.by(() => {
		if (!root) return {} as Record<string, string>;
		const style = getComputedStyle(root);
		return Object.fromEntries(
			[...COLORS, ...FACES].map(([token]) => [token, style.getPropertyValue(token).trim()])
		);
	});
</script>

<div class="tokens" bind:this={root}>
	<h2>Colour</h2>
	<ul class="swatches">
		{#each COLORS as [token, use] (token)}
			<li>
				<span class="chip" style:background="var({token})"></span>
				<code>{token}</code>
				<span>{use}</span>
				<span class="value">{values[token]}</span>
			</li>
		{/each}
	</ul>

	<h2>Type</h2>
	<ul class="faces">
		{#each FACES as [token, use, sample] (token)}
			<li>
				<code>{token}</code> <span>{use}</span>
				<p style:font-family="var({token})">{sample}</p>
			</li>
		{/each}
	</ul>
</div>

<style>
	.tokens {
		display: grid;
		gap: 24px;
		padding: 24px;
		background: var(--bg);
		color: var(--ink);
		font-family: var(--body);
	}
	h2 {
		margin: 0;
		font-family: var(--display);
		font-weight: var(--display-weight);
		font-stretch: var(--display-stretch);
		text-transform: uppercase;
	}
	ul {
		display: grid;
		gap: 12px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.swatches {
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
	}
	.swatches li {
		display: grid;
		gap: 4px;
	}
	.chip {
		height: 56px;
		border: 1px solid var(--line-strong);
	}
	code,
	.value {
		font-family: var(--mono);
		font-size: 13px;
	}
	.value {
		color: var(--ink-dim);
	}
	.faces p {
		margin: 4px 0 0;
		font-size: 32px;
	}
</style>
