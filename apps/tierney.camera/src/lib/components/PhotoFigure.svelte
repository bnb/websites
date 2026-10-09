<script lang="ts">
	import type { LikeCounts, Photo, Swatch } from '../types';
	import { aspect, type RowFit } from '../layout';
	import { blobUrl, fullUrl, thumbUrl } from '../atproto';
	import { exposure, frameNumber, shortPlace, stampDate } from '../format';
	import { resilient, sharpen } from '@bnb/ui';
	import ColourStrip from './ColourStrip.svelte';
	import FStop from './FStop.svelte';
	import Like from './Like.svelte';

	let {
		photo,
		index,
		pds,
		feature = false,
		fit,
		priority = false,
		palette,
		likes,
		onopen
	}: {
		photo: Photo;
		/** position in the full set: drives the frame number and the lightbox */
		index: number;
		pds: string;
		/** run full width between the justified rows */
		feature?: boolean;
		/** this photograph's place in its row, once the gallery has justified them */
		fit?: RowFit | null;
		/** above-the-fold photographs: load eagerly and skip the reveal-fade (better LCP) */
		priority?: boolean;
		/** its dominant colours, once the server has read them */
		palette?: Swatch[];
		/** how many people have liked each gallery, from the server */
		likes?: LikeCounts;
		onopen: () => void;
	} = $props();

	let loaded = $state(false);
	let intersected = $state(false);
	const visible = $derived(priority || intersected);
	let figure: HTMLElement;

	const number = $derived(frameNumber(index));
	const date = $derived(stampDate(photo.date));
	const where = $derived([shortPlace(photo.place) || 'Untitled', date].filter(Boolean).join(' · '));
	const spec = $derived(exposure(photo));
	const specShort = $derived(exposure(photo, true));

	const ratio = $derived(aspect(photo));
	const label = $derived(`Open photograph ${number}${photo.place ? `, ${photo.place}` : ''}`);
	const altText = $derived(photo.alt || (photo.place ? `Photograph, ${photo.place}` : 'Photograph'));

	$effect(() => {
		if (priority) return; // already visible; no reveal needed
		const io = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) {
					intersected = true;
					io.disconnect();
				}
			},
			{ rootMargin: '0px 0px -8% 0px' }
		);
		if (figure) io.observe(figure);
		return () => io.disconnect();
	});

</script>

<figure
	bind:this={figure}
	class="shot"
	class:in={visible}
	class:feature
	class:fitted={!!fit}
	style:--ar={ratio}
	style:--share={fit?.share}
	style:--count={fit?.count}
	data-index={index}
>
	<button class="frame" class:loaded type="button" aria-label={label} onclick={onopen}>
		<img
			src={thumbUrl(photo.cid)}
			alt={altText}
			loading={priority ? 'eager' : 'lazy'}
			fetchpriority={priority ? 'high' : 'auto'}
			decoding="async"
			{@attach resilient([blobUrl(pds, photo.cid)], () => (loaded = true))}
			{@attach sharpen([fullUrl(photo.cid), blobUrl(pds, photo.cid)])}
		/>
	</button>
	<figcaption class="cap mono">
		<span>
			<span class="n">{number}</span><span class="long">{where}</span><span class="short">{date}</span>
		</span>
		<span class="end">
			{#if spec}
				<span class="spec"><span class="long"><FStop text={spec} /></span><span class="short"><FStop text={specShort} /></span></span>
			{/if}
			{#if photo.gallery}
				<Like subject={photo.gallery} label="photograph {number}" counts={likes} />
			{/if}
		</span>
		<ColourStrip swatches={palette} />
	</figcaption>
</figure>

<style>
	/* A justified row: each figure's basis and growth are proportional to its
	   aspect ratio, so every frame in a row ends up the same height. Growth is
	   scaled by 10 because flexbox hands out only part of the free space when a
	   row's growth factors sum to less than 1 (a lone portrait). The row height
	   and growth cap come from the gallery. Server-rendered, the browser decides
	   the row breaks; then the gallery takes over (.fitted, below). */
	.shot {
		flex: calc(var(--ar) * 10) 1 calc(var(--ar) * var(--row-h, 260px));
		/* a short row (the last one, or one before a feature) grows only so far,
		   then centres, so a lone photograph doesn't balloon */
		max-width: calc(var(--ar) * var(--row-h, 260px) * var(--grow-max, 1.8));
		display: flex;
		flex-direction: column;
		gap: 10px;
		min-width: 0;
		/* captions switch to their short form when the figure itself is narrow */
		container-type: inline-size;
		transition:
			opacity 1s var(--ease),
			transform 1s var(--ease);
	}
	.feature {
		flex: 1 1 100%;
		max-width: none;
	}
	/* justified by the gallery: the row's photographs split its width by aspect
	   ratio, so it fills exactly and the next photograph wraps to a new row. The
	   0.1px keeps subpixel rounding from wrapping one early; growth hands it back. */
	.fitted {
		flex-basis: calc((100% - (var(--count) - 1) * var(--gap-x)) * var(--share) - 0.1px);
		max-width: none;
	}

	/* progressive-enhancement reveal: only hide when JS is running (html.js),
	   so no-JS / SSR output stays fully visible for crawlers and LCP. */
	:global(html.js) .shot:not(.in) {
		opacity: 0;
		transform: translateY(18px);
	}

	.frame {
		position: relative;
		display: block;
		width: 100%;
		aspect-ratio: var(--ar);
		padding: 0;
		border: 0;
		overflow: hidden;
		cursor: zoom-in;
		background: var(--bg-soft);
	}
	/* a letterbox that widens with the screen: about 3:2 on a phone, wider on a desktop */
	.feature .frame {
		aspect-ratio: auto;
		height: clamp(240px, 38vw, 75vh);
	}
	.frame:not(.loaded) {
		background: linear-gradient(100deg, #141414 30%, #1d1d1d 50%, #141414 70%);
		background-size: 200% 100%;
		animation: sheen 1.4s infinite;
	}
	.frame:focus-visible {
		outline-offset: -2px;
	}

	img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition: transform 0.8s var(--ease);
	}
	.frame:hover img {
		transform: scale(1.035);
	}

	.cap {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 4px 12px;
		font-size: 12px;
		letter-spacing: 0.06em;
		color: var(--ink-dim);
	}
	.n {
		margin-right: 1.4ch;
		color: var(--accent);
	}
	.end {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 14px;
	}
	.short {
		display: none;
	}

	/* narrow figures: date only, and aperture + ISO */
	@container (max-width: 279px) {
		.long {
			display: none;
		}
		.short {
			display: inline;
		}
	}
</style>
