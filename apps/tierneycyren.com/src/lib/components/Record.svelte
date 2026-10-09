<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		spinning = false,
		arm = 'rest',
		turn = 0,
		children,
		...rest
	}: {
		/** turning, as while its mix plays */
		spinning?: boolean;
		/** the tonearm: swung clear, down on the record, or lifting off it */
		arm?: 'rest' | 'down' | 'lift';
		/** degrees the record has been turned by hand */
		turn?: number;
		/** the label, e.g. a mix's cover art; a plain cyan-to-magenta label without one */
		children?: Snippet;
	} & HTMLAttributes<HTMLDivElement> = $props();
</script>

<!-- A record on a platter: decoration only, so it's hidden from assistive tech.
     Each mix keeps its native audio controls; the record is a pointer enhancement. -->
<div class="record" aria-hidden="true" {...rest}>
	<div class="disc" class:spinning>
		<div class="turn" style:rotate="{turn}deg">
			<div class="label">{@render children?.()}</div>
		</div>
	</div>
	<span class="sheen"></span>
	<svg class="arm {arm}" viewBox="0 0 100 100">
		<circle class="pivot" cx="90" cy="8" r="5.5" />
		<path class="tube" d="M90 8 L81 62 L77.4 72" />
		<path class="headshell" d="M77.6 71 L75.6 80.5" />
	</svg>
</div>

<style>
	.record {
		position: relative;
		aspect-ratio: 1;
	}

	/* the vinyl: fine grooves, a run-out ring next to the label and a lip at the edge */
	.disc {
		position: absolute;
		inset: 0;
		border-radius: 50%;
		background:
			radial-gradient(
				circle,
				transparent 0 61%,
				color-mix(in srgb, var(--ink) 9%, transparent) 61.5% 62.5%,
				transparent 63%
			),
			repeating-radial-gradient(circle, #08050f 0 1.5px, #161024 1.5px 2.5px);
		box-shadow:
			inset 0 0 0 2px #221a35,
			0 14px 40px rgb(0 0 0 / 0.55);
		animation: spin 1.8s linear infinite paused;
		transition: box-shadow 0.6s var(--ease);
	}
	/* 33⅓ rpm is one turn every 1.8 seconds */
	.spinning {
		animation-play-state: running;
		box-shadow:
			inset 0 0 0 2px #221a35,
			0 14px 40px rgb(0 0 0 / 0.55),
			0 0 36px color-mix(in srgb, var(--accent) 22%, transparent);
	}

	.turn {
		position: absolute;
		inset: 0;
	}

	.label {
		position: absolute;
		inset: 20%;
		overflow: hidden;
		border-radius: 50%;
		background:
			radial-gradient(circle, var(--bg) 0 4%, transparent 4.5%),
			linear-gradient(135deg, var(--accent), var(--highlight));
	}
	.label :global(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	/* the spindle hole, over the art */
	.label::after {
		content: '';
		position: absolute;
		inset: 46%;
		border-radius: 50%;
		background: var(--bg);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--ink) 30%, transparent);
	}

	/* light on the grooves stays put while the record turns under it */
	.sheen {
		position: absolute;
		inset: 0;
		border-radius: 50%;
		background: conic-gradient(
			from 20deg,
			transparent,
			rgb(255 255 255 / 0.07) 6%,
			transparent 14% 50%,
			rgb(255 255 255 / 0.07) 56%,
			transparent 64%
		);
		mask-image: radial-gradient(circle, transparent 60%, black 61%);
		pointer-events: none;
	}

	.arm {
		position: absolute;
		inset: 0;
		overflow: visible;
		pointer-events: none;
	}
	.arm path,
	.arm circle {
		transform-box: view-box;
		transform-origin: 90px 8px;
		transition: rotate 0.7s var(--ease);
	}
	.rest :is(path, circle) {
		rotate: -20deg;
	}
	.lift :is(path, circle) {
		animation: lift 1.4s var(--ease) 0.3s both;
	}
	.pivot {
		fill: var(--bg-soft);
		stroke: var(--line-strong);
		stroke-width: 1;
	}
	.tube {
		fill: none;
		stroke: var(--ink-dim);
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.headshell {
		stroke: var(--accent);
		stroke-width: 4.5;
		stroke-linecap: round;
	}

	@keyframes spin {
		to {
			transform: rotate(1turn);
		}
	}
	/* the needle rises off the grooves and swings clear */
	@keyframes lift {
		to {
			rotate: -14deg;
			translate: 0 -1.5px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.disc {
			animation: none;
		}
		.lift :is(path, circle) {
			animation: none;
			rotate: -14deg;
		}
	}
</style>
