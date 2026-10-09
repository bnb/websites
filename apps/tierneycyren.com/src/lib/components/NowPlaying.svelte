<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import { isoDuration, runningTime } from '../format';
	import type { Mix } from '../types';

	let {
		mix,
		playing,
		time,
		duration,
		ontoggle
	}: {
		/** the mix on the deck; the bar stays away until one has played */
		mix: Mix | null;
		playing: boolean;
		/** seconds */
		time: number;
		/** seconds */
		duration: number;
		ontoggle: () => void;
	} = $props();

	const clock = (seconds: number) => runningTime(seconds) || '0:00';

	/** whether the title is wider than its space, so it needs to scroll */
	let overflows = $state(false);
	// compares the first copy of the title with its window, re-measured when
	// either changes size (a new title, a resized window); the second copy
	// doesn't change the first's size, so adding it can't flip the answer
	const measure: Attachment<HTMLElement> = (node) => {
		const title = node.querySelector('.run');
		if (!title) return;
		const resize = new ResizeObserver(() => {
			overflows = title.scrollWidth > node.clientWidth;
		});
		resize.observe(node);
		resize.observe(title);
		return () => resize.disconnect();
	};
</script>

<!-- Sticky at the foot of the page column rather than fixed over it, so it sits
     after the footer once scrolled to the end and never hides anything there. -->
{#if mix}
	<section class="now" aria-label="Now playing">
		<span
			class="progress"
			aria-hidden="true"
			style:width="{duration ? Math.min(time / duration, 1) * 100 : 0}%"
		></span>
		<button
			type="button"
			class="toggle"
			aria-label="{playing ? 'Pause' : 'Play'} {mix.title}"
			onclick={ontoggle}
		>
			<svg viewBox="0 0 24 24" aria-hidden="true">
				{#if playing}<path d="M7 5h3.6v14H7zm6.4 0H17v14h-3.6z" />{:else}<path
						d="M8 5v14l11-7z"
					/>{/if}
			</svg>
		</button>
		<div class="title">
			<span class="kicker mono">Now playing</span>
			<!-- a title too long for the bar scrolls like a deck's display while the
			     mix plays; the pause button stops it -->
			<span class="window" {@attach measure}>
				<span class="ticker" class:scrolls={overflows} class:running={playing}>
					<span class="run">{mix.title}</span>{#if overflows}<span class="run" aria-hidden="true"
							>{mix.title}</span
						>{/if}
				</span>
			</span>
		</div>
		<p class="time mono">
			<time datetime={isoDuration(time)}>{clock(time)}</time>
			<span aria-hidden="true">/</span>
			<span class="sr-only">of</span>
			<time datetime={isoDuration(duration)}>{clock(duration)}</time>
		</p>
		<!-- says which mix is on when it changes, and nothing else (not the clock) -->
		<p class="sr-only" role="status">Now playing: {mix.title}</p>
	</section>
{/if}

<style>
	.now {
		position: sticky;
		bottom: 0;
		z-index: 10;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 16px;
		padding: 10px var(--pad) calc(10px + env(safe-area-inset-bottom));
		border-top: 1px solid var(--line);
		background: color-mix(in srgb, var(--bg) 88%, transparent);
		backdrop-filter: blur(14px);
		animation: arrive 0.4s var(--ease);
	}

	.progress {
		position: absolute;
		top: -1px;
		left: 0;
		height: 2px;
		background: var(--accent);
		box-shadow: 0 0 10px var(--accent);
	}

	.toggle {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border: 0;
		border-radius: 50%;
		background: var(--accent);
		color: var(--accent-ink);
		cursor: pointer;
		transition: box-shadow 0.2s var(--ease);
	}
	.toggle:hover {
		box-shadow: 0 0 18px color-mix(in srgb, var(--accent) 60%, transparent);
	}
	svg {
		width: 22px;
		height: 22px;
		fill: currentColor;
	}

	.title {
		display: grid;
		gap: 2px;
		min-width: 0;
	}
	.kicker {
		color: var(--highlight);
		font-size: 11px;
	}
	.window {
		overflow: hidden;
	}
	.ticker {
		display: flex;
		width: max-content;
		font-size: 24px;
		font-weight: 900;
		font-stretch: 62%;
		line-height: 1;
		text-transform: uppercase;
		white-space: nowrap;
	}
	.scrolls {
		mask-image: linear-gradient(to right, black calc(100% - 32px), transparent);
		animation: ticker 16s linear infinite paused;
	}
	.run + .run {
		margin-left: 2.5em;
	}
	.running {
		animation-play-state: running;
	}
	.window:hover .ticker {
		animation-play-state: paused;
	}

	.time {
		display: flex;
		gap: 6px;
		color: var(--ink-dim);
		font-variant-numeric: tabular-nums;
	}
	.time time {
		color: var(--ink);
	}

	/* one copy and the gap after it: the second copy then sits where the first began */
	@keyframes ticker {
		to {
			transform: translateX(calc(-50% - 1.25em));
		}
	}
	@keyframes arrive {
		from {
			transform: translateY(100%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.ticker {
			animation: none;
		}
		.run + .run {
			display: none;
		}
	}
</style>
