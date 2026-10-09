<script lang="ts">
	import type { LikeCounts, Photo } from '../types';
	import { blobUrl, fullUrl, thumbUrl } from '../atproto';
	import { exposure, frameNumber, shortPlace, stampDate } from '../format';
	import { resilient, sharpen } from '@bnb/ui';
	import FStop from './FStop.svelte';
	import Like from './Like.svelte';

	let {
		photo,
		index,
		pds,
		likes,
		onopen
	}: {
		photo: Photo;
		index: number;
		pds: string;
		/** how many people have liked each gallery, from the server */
		likes?: LikeCounts;
		onopen: () => void;
	} = $props();

	const number = $derived(frameNumber(index));
	const where = $derived(
		[shortPlace(photo.place), stampDate(photo.date)].filter(Boolean).join(' · ')
	);
	const spec = $derived(exposure(photo));
	const altText = $derived(photo.alt || (photo.place ? `Photograph, ${photo.place}` : 'Photograph'));
</script>

<section class="feature" aria-label="Featured photograph">
	<figure>
		<button
			class="frame"
			type="button"
			aria-label="Open photograph {number}{photo.place ? `, ${photo.place}` : ''}"
			onclick={onopen}
		>
			<img
				src={thumbUrl(photo.cid)}
				alt={altText}
				loading="eager"
				fetchpriority="high"
				decoding="async"
				{@attach resilient([blobUrl(pds, photo.cid)])}
				{@attach sharpen([fullUrl(photo.cid), blobUrl(pds, photo.cid)])}
			/>
		</button>
		<figcaption class="mono">
			<span><span class="n">{number}</span>{where}</span>
			{#if spec}<span class="spec"><FStop text={spec} /></span>{/if}
			{#if photo.gallery}
				<Like subject={photo.gallery} label="photograph {number}" counts={likes} />
			{/if}
		</figcaption>
	</figure>
</section>

<style>
	.feature {
		padding: clamp(36px, 4vw, 56px) var(--pad) 0;
	}

	figure {
		position: relative;
	}

	.frame {
		position: relative;
		display: block;
		width: 100%;
		height: clamp(320px, 46vw, 660px);
		padding: 0;
		border: 0;
		overflow: hidden;
		cursor: zoom-in;
		background: var(--bg-soft);
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
		transition: transform 1.2s var(--ease);
	}
	.frame:hover img {
		transform: scale(1.02);
	}

	figcaption {
		position: absolute;
		left: 0;
		bottom: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 20px;
		max-width: 100%;
		padding: 12px 16px;
		background: var(--bg);
		font-size: 12px;
		letter-spacing: 0.06em;
		pointer-events: none;
	}
	.n {
		margin-right: 1.4ch;
		color: var(--accent);
	}
	.spec {
		color: var(--ink-dim);
	}
</style>
