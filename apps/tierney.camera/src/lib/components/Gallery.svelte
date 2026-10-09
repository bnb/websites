<script lang="ts">
	import type { LikeCounts, Photo, Swatch } from '../types';
	import { justify, type Tile } from '../layout';
	import { HANDLE } from '../atproto';
	import PhotoFigure from './PhotoFigure.svelte';

	let {
		photos,
		tiles,
		pds,
		range = '',
		loadError = false,
		palettes = {},
		likes,
		onselect
	}: {
		photos: Photo[];
		/** from flyerLayout(): every photograph except the featured one */
		tiles: Tile[];
		pds: string;
		/** e.g. "May – Aug 2026" */
		range?: string;
		loadError?: boolean;
		/** each photograph's dominant colours, by CID, for those that have them yet */
		palettes?: Record<string, Swatch[]>;
		/** how many people have liked each gallery, from the server */
		likes?: LikeCounts;
		onselect: (index: number) => void;
	} = $props();

	// the grid's width, the row height it aims for and its gutter, kept current as it resizes
	let measured = $state<{ width: number; target: number; gap: number }>();
	const fits = $derived(
		measured ? justify(tiles, photos, measured.width, measured.target, measured.gap) : []
	);

	function measure(grid: HTMLElement) {
		const observer = new ResizeObserver(([entry]) => {
			const style = getComputedStyle(grid);
			const target = parseFloat(style.getPropertyValue('--row-target'));
			const gap = parseFloat(style.columnGap) || 0;
			if (entry.contentRect.width > 0 && target > 0) {
				measured = { width: entry.contentRect.width, target, gap };
			}
		});
		observer.observe(grid);
		return () => observer.disconnect();
	}
</script>

<section id="work" class="work" aria-labelledby="work-title">
	<div class="head">
		<h2 id="work-title">The work</h2>
		{#if photos.length}
			<p class="mono">
				{photos.length}
				{photos.length === 1 ? 'photograph' : 'photographs'}{range ? ` · ${range}` : ''}
			</p>
		{/if}
	</div>

	{#if tiles.length}
		<!-- Justified rows. Server-rendered, flexbox alone packs as many photographs into
		     a row as fit; once the grid knows its width, justify() picks the row breaks so
		     that every row fills the width, regrouping as the window is resized. -->
		<div class="grid" {@attach measure}>
			{#each tiles as tile, n (photos[tile.index].uri)}
				<PhotoFigure
					photo={photos[tile.index]}
					index={tile.index}
					{pds}
					feature={tile.feature}
					fit={fits[n]}
					palette={palettes[photos[tile.index].cid]}
					{likes}
					onopen={() => onselect(tile.index)}
				/>
			{/each}
		</div>
	{:else if !photos.length}
		<p class="state mono">
			{#if loadError}
				Couldn't reach the AT&nbsp;Protocol right now.
			{:else}
				No photographs found in this repository yet.
			{/if}
			<br /><br />
			View the source records on
			<a href="https://grain.social/profile/{HANDLE}" target="_blank" rel="noopener">grain.social</a>.
		</p>
	{/if}
</section>

<style>
	.work {
		padding: clamp(48px, 6vw, 96px) var(--pad) 0;
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: flex-end;
		gap: 12px 24px;
		padding-bottom: 16px;
		margin-bottom: 28px;
		border-bottom: 1px solid var(--line);
	}
	h2 {
		font-size: clamp(36px, 5vw, 76px);
		font-weight: 900;
		font-stretch: 125%;
		line-height: 0.9;
		letter-spacing: -0.01em;
		text-transform: uppercase;
	}
	.head p {
		color: var(--ink-dim);
	}

	.grid {
		/* the shortest a server-rendered row gets; wider screens fit more photographs per row */
		--row-h: clamp(150px, 9vw + 140px, 400px);
		/* how far a server-rendered row may stretch past that before it centres instead */
		--grow-max: 1.8;
		/* the height a justified row aims for: those flexbox rows only ever grow past
		   --row-h, so they average about a quarter taller (registered in app.css so
		   the script can read it in pixels) */
		--row-target: calc(var(--row-h) * 1.25);
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		align-items: flex-start;
		gap: var(--gap-y) var(--gap-x);
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

	/* phone: a lone portrait may fill the width, and the gutters tighten */
	@media (max-width: 639px) {
		.grid {
			--grow-max: 4;
			--gap-x: 10px;
			--gap-y: 24px;
		}
	}
</style>
