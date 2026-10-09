<script lang="ts">
	import type { LikeCounts, Photo, Swatch } from '../types';
	import { blobUrl, fullUrl, thumbUrl } from '../atproto';
	import { formatDate } from '../exif';
	import { frameNumber } from '../format';
	import { resilient, sharpen } from '@bnb/ui';
	import ColourStrip from './ColourStrip.svelte';
	import FStop from './FStop.svelte';
	import LightMeter from './LightMeter.svelte';
	import Like from './Like.svelte';

	let {
		photos,
		pds,
		index,
		palettes = {},
		likes,
		onclose,
		onnav
	}: {
		photos: Photo[];
		pds: string;
		index: number;
		/** each photograph's dominant colours, by CID, for those that have them yet */
		palettes?: Record<string, Swatch[]>;
		/** how many people have liked each gallery, from the server */
		likes?: LikeCounts;
		onclose: () => void;
		onnav: (direction: number) => void;
	} = $props();

	const SWIPE_PX = 48;

	const isOpen = $derived(index >= 0 && index < photos.length);
	const photo = $derived(isOpen ? photos[index] : null);

	let imgLoaded = $state(false);
	let dialog = $state<HTMLDialogElement>();
	let touchX: number | null = null;

	const counter = $derived(
		isOpen ? `${frameNumber(index)} / ${String(photos.length).padStart(2, '0')}` : ''
	);
	const exposure = $derived(
		photo ? [photo.focal, photo.aperture, photo.shutter, photo.iso].filter(Boolean) : []
	);
	const gear = $derived(photo ? [photo.camera, photo.lens].filter(Boolean).join('  ·  ') : '');
	const altText = $derived(
		photo ? photo.alt || (photo.place ? `Photograph, ${photo.place}` : 'Photograph') : ''
	);

	// reset per-image load state whenever the selection changes
	$effect(() => {
		if (index >= 0) imgLoaded = false;
	});

	// warm the neighbours' thumbnails for instant paging (they sharpen on arrival)
	$effect(() => {
		if (!isOpen) return;
		const n = photos.length;
		for (const direction of [1, -1]) {
			const neighbour = photos[(index + direction + n) % n];
			if (neighbour) {
				const preloaded = new Image();
				preloaded.src = thumbUrl(neighbour.cid);
			}
		}
	});

	// open as a modal (the page behind goes inert), move focus in, and hand it
	// back to the opener on close. Focus goes to the dialog itself, not Close:
	// a focused button would light up its focus ring on the first arrow key.
	$effect(() => {
		if (!isOpen || !dialog) return;
		const node = dialog;
		const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		if (!node.open) node.showModal();
		node.focus();
		return () => {
			if (node.open) node.close();
			opener?.focus({ preventScroll: true });
		};
	});

	// lock body scroll + wire keyboard navigation (and a focus trap) while open
	$effect(() => {
		if (!isOpen) return;
		const previous = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		window.addEventListener('keydown', handleKey);
		return () => {
			document.body.style.overflow = previous;
			window.removeEventListener('keydown', handleKey);
		};
	});

	// Escape is the dialog's own cancel → close (see onclose on the element).
	// Keys inside a dialog opened over this one (signing in to like) are its own.
	function handleKey(event: KeyboardEvent) {
		const within = event.target instanceof Element ? event.target.closest('dialog') : null;
		if (within && within !== dialog) return;
		if (event.key === 'ArrowRight') onnav(1);
		else if (event.key === 'ArrowLeft') onnav(-1);
		else if (event.key === 'Tab' && dialog) {
			// wrap within the controls actually on screen (the arrows hide on phones)
			const focusable = [...dialog.querySelectorAll<HTMLElement>('button, a[href]')].filter(
				(el) => el.getClientRects().length > 0
			);
			const first = focusable[0];
			const last = focusable.at(-1);
			const active = document.activeElement;
			if (active === dialog) {
				event.preventDefault();
				(event.shiftKey ? last : first)?.focus();
			} else if (event.shiftKey && active === first) {
				event.preventDefault();
				last?.focus();
			} else if (!event.shiftKey && active === last) {
				event.preventDefault();
				first?.focus();
			}
		}
	}

	function handleBackdrop(event: MouseEvent) {
		if (event.target === event.currentTarget) onclose();
	}

	function handleTouchStart(event: TouchEvent) {
		touchX = event.touches.length === 1 ? event.touches[0].clientX : null;
	}

	function handleTouchEnd(event: TouchEvent) {
		if (touchX === null) return;
		const dx = event.changedTouches[0].clientX - touchX;
		touchX = null;
		if (Math.abs(dx) >= SWIPE_PX) onnav(dx < 0 ? 1 : -1);
	}
</script>

{#if isOpen && photo}
	<dialog
		bind:this={dialog}
		class="lb"
		tabindex="-1"
		aria-label="Photograph viewer"
		{onclose}
		ontouchstart={handleTouchStart}
		ontouchend={handleTouchEnd}
	>
		<div class="bar mono">
			<span class="count" aria-live="polite">{counter}</span>
			{#if photo.gallery}
				<span class="like">
					<Like subject={photo.gallery} label="photograph {frameNumber(index)}" counts={likes} large />
				</span>
			{/if}
			<button class="close" type="button" onclick={onclose}>
				Close
				<svg viewBox="0 0 16 16" aria-hidden="true">
					<path d="M3 3l10 10M13 3L3 13" />
				</svg>
			</button>
		</div>

		<div class="stage" onclick={handleBackdrop} role="presentation">
			<button class="nav prev" type="button" onclick={() => onnav(-1)} aria-label="Previous photograph">
				<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12H4M10 6l-6 6 6 6" /></svg>
			</button>

			<img
				class:ready={imgLoaded}
				src={thumbUrl(photo.cid)}
				alt={altText}
				{@attach resilient([blobUrl(pds, photo.cid)], () => (imgLoaded = true))}
				{@attach sharpen([fullUrl(photo.cid), blobUrl(pds, photo.cid)])}
			/>

			<button class="nav next" type="button" onclick={() => onnav(1)} aria-label="Next photograph">
				<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16M14 6l6 6-6 6" /></svg>
			</button>
		</div>

		<div class="info">
			<div class="caption">
				<div class="place">{photo.place || 'Untitled'}</div>
				<div class="date mono">{formatDate(photo.date)}</div>
				<ColourStrip swatches={palettes[photo.cid]} />
			</div>
			<div class="exif mono">
				{#if exposure.length}
					<span class="exposure">
						{#each exposure as value, i (value + i)}
							<b><FStop text={value} /></b>{#if i < exposure.length - 1}<span class="sep">·</span>{/if}
						{/each}
					</span>
				{/if}
				{#if gear}
					<span class="gear"><FStop text={gear} /></span>
				{/if}
			</div>
			{#if photo.ev !== null}
				<LightMeter ev={photo.ev} />
			{/if}
		</div>
	</dialog>
{/if}

<style>
	/* a native modal <dialog>, stretched over the whole viewport */
	.lb {
		position: fixed;
		inset: 0;
		width: 100%;
		height: 100%;
		max-width: none;
		max-height: none;
		margin: 0;
		padding: 0;
		border: 0;
		overflow: hidden;
		grid-template-rows: auto 1fr auto;
		background: var(--bg);
		color: var(--ink);
		touch-action: pan-y;
	}
	.lb[open] {
		display: grid;
		animation: fade 0.35s var(--ease);
	}
	/* the dialog only holds focus as a starting point; it isn't a control */
	.lb:focus {
		outline: none;
	}
	.lb::backdrop {
		background: var(--bg);
	}

	.bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
		padding: 4px var(--pad);
		border-bottom: 1px solid var(--line);
	}
	.count {
		color: var(--accent);
	}
	/* beside Close, on the right */
	.like {
		margin-left: auto;
	}
	.close {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
		text-transform: inherit;
		letter-spacing: inherit;
		transition: color 0.2s var(--ease);
	}
	.close:hover {
		color: var(--accent);
	}
	.close svg {
		width: 14px;
		height: 14px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.6;
	}

	.stage {
		position: relative;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: clamp(16px, 3vw, 40px) clamp(16px, 7vw, 110px);
	}
	/* fills the stage, so swapping in a sharper source never changes its size */
	.stage img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		opacity: 0;
		transform: scale(0.985);
		transition:
			opacity 0.5s var(--ease),
			transform 0.5s var(--ease);
	}
	.stage img.ready {
		opacity: 1;
		transform: none;
	}

	.nav {
		position: absolute;
		top: 50%;
		width: 56px;
		height: 56px;
		margin-top: -28px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--line-strong);
		border-radius: 50%;
		background: var(--bg);
		cursor: pointer;
		transition:
			color 0.2s var(--ease),
			background 0.2s var(--ease),
			border-color 0.2s var(--ease);
	}
	.nav:hover {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--accent-ink);
	}
	.nav.prev {
		left: clamp(12px, 2.4vw, 40px);
	}
	.nav.next {
		right: clamp(12px, 2.4vw, 40px);
	}
	.nav svg {
		width: 22px;
		height: 22px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.6;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.info {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 12px 28px;
		padding: 18px var(--pad) clamp(22px, 4vh, 40px);
		border-top: 1px solid var(--line);
	}
	.place {
		font-size: clamp(22px, 2.6vw, 36px);
		font-weight: 900;
		font-stretch: 125%;
		line-height: 0.95;
		text-transform: uppercase;
	}
	.date {
		margin: 8px 0 12px;
		font-size: 12px;
		color: var(--ink-dim);
	}
	.exif {
		display: flex;
		flex-direction: column;
		margin-left: auto;
		gap: 6px;
		align-items: flex-end;
		text-align: right;
		font-size: 12px;
		color: var(--ink-dim);
	}
	.exif b {
		color: var(--ink);
		font-weight: 500;
	}
	.exif .sep {
		padding: 0 0.8ch;
		color: var(--accent);
	}

	@media (max-width: 760px) {
		.nav {
			display: none;
		}
		.info {
			flex-direction: column;
			align-items: flex-start;
		}
		.exif {
			align-items: flex-start;
			margin-left: 0;
			text-align: left;
		}
	}
</style>
