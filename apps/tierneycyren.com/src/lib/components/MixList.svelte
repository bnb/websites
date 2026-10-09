<script lang="ts">
	import { mixNumber, mixSummary } from '../format';
	import { player } from '../player.svelte';
	import { PLYR_PROFILE } from '../site';
	import type { Mix as MixData } from '../types';
	import Mix from './Mix.svelte';

	let { mixes, loadError = false }: { mixes: MixData[]; loadError?: boolean } = $props();

	const summary = $derived(mixSummary(mixes));
	const longest = $derived(Math.max(0, ...mixes.map((mix) => mix.duration)));
</script>

<section id="mixes" class="mixes" class:live={player.playing} aria-labelledby="mixes-title">
	<div class="head">
		<h2 id="mixes-title">Mixes</h2>
		{#if summary}<p class="mono">{summary}</p>{/if}
	</div>

	{#if mixes.length}
		<ol>
			{#each mixes as mix, i (mix.uri)}
				<li><Mix {mix} number={mixNumber(i, mixes.length)} {longest} priority={i === 0} /></li>
			{/each}
		</ol>
	{:else}
		<p class="state mono">
			{#if loadError}
				Couldn't reach the AT&nbsp;Protocol right now.
			{:else}
				No mixes up yet.
			{/if}
			<br /><br />
			Listen on <a href={PLYR_PROFILE} target="_blank" rel="noopener">plyr.fm</a>.
		</p>
	{/if}
</section>

<style>
	.mixes {
		padding: clamp(48px, 6vw, 96px) var(--pad) 0;
		transition: --energy 0.6s var(--ease);
	}
	/* the heading glows a little brighter while anything plays (see app.css) */
	.live {
		--energy: 0.4;
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: flex-end;
		gap: 12px 24px;
		padding-bottom: 16px;
		margin-bottom: clamp(28px, 4vw, 56px);
		border-bottom: 1px solid var(--line);
	}
	h2 {
		font-size: clamp(44px, 7vw, 112px);
		font-weight: 900;
		font-stretch: 62%;
		line-height: 0.85;
		text-transform: uppercase;
	}
	.head p {
		color: var(--ink-dim);
	}

	ol {
		display: grid;
		gap: clamp(48px, 7vw, 112px);
		list-style: none;
	}

	.state {
		padding: clamp(48px, 12vh, 140px) 0;
		color: var(--ink-faint);
		line-height: 1.8;
	}
	.state a {
		color: var(--ink-dim);
		border-bottom: 1px solid var(--line-strong);
	}
</style>
