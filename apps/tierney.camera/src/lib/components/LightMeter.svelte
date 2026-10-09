<script module lang="ts">
	// An analog light meter: a needle on an arc from EV −2 to 16, to scale.
	// The needle pivots below the window, like a VU meter's.
	const EV_MIN = -2;
	const EV_MAX = 16;
	/** below this, the scene was lit like a club or a street at night */
	const LOW_LIGHT_EV = 5;
	/** degrees either side of upright the scale spans */
	const HALF_SWEEP = 50;

	const PIVOT = { x: 100, y: 112 };
	const SCALE_R = 92;
	const LABEL_R = 103;

	/** a reading off either end of the scale pins the needle there */
	const onScale = (ev: number) => Math.min(Math.max(ev, EV_MIN), EV_MAX);
	const angle = (ev: number) => ((onScale(ev) - EV_MIN) / (EV_MAX - EV_MIN) - 0.5) * 2 * HALF_SWEEP;

	/** the point `r` from the pivot at EV `ev` */
	function at(ev: number, r: number) {
		const radians = (angle(ev) * Math.PI) / 180;
		return { x: PIVOT.x + r * Math.sin(radians), y: PIVOT.y - r * Math.cos(radians) };
	}

	function arc(from: number, to: number, r: number) {
		const start = at(from, r);
		const end = at(to, r);
		return `M${start.x} ${start.y}A${r} ${r} 0 0 1 ${end.x} ${end.y}`;
	}

	const ticks = Array.from({ length: EV_MAX - EV_MIN + 1 }, (_, i) => {
		const ev = EV_MIN + i;
		const major = ev % 2 === 0;
		return {
			ev,
			major,
			outer: at(ev, SCALE_R),
			inner: at(ev, SCALE_R - (major ? 8 : 4)),
			label: at(ev, LABEL_R)
		};
	});
</script>

<script lang="ts">
	import { formatEv } from '../format';

	let { ev }: { ev: number } = $props();

	// the needle rests at the bottom of the scale until the meter is on screen, then swings up
	let settled = $state(false);
	$effect(() => {
		const frame = requestAnimationFrame(() => (settled = true));
		return () => cancelAnimationFrame(frame);
	});

	const reading = $derived(formatEv(ev));
	const lowLight = $derived(ev < LOW_LIGHT_EV);
	const needle = $derived(angle(settled ? ev : EV_MIN));
</script>

<div
	class="meter"
	role="meter"
	aria-label="Light meter"
	aria-valuemin={EV_MIN}
	aria-valuemax={EV_MAX}
	aria-valuenow={onScale(ev)}
	aria-valuetext="{reading}{lowLight ? ', low light' : ''}"
>
	<svg viewBox="0 0 200 76" aria-hidden="true">
		<path class="band" d={arc(EV_MIN, LOW_LIGHT_EV, SCALE_R)} />
		<path class="scale" d={arc(EV_MIN, EV_MAX, SCALE_R)} />
		<!-- the lower edge of the window the needle swings up through -->
		<line class="sill" x1="0" y1="75.5" x2="200" y2="75.5" />
		{#each ticks as tick (tick.ev)}
			<line
				class:major={tick.major}
				x1={tick.outer.x}
				y1={tick.outer.y}
				x2={tick.inner.x}
				y2={tick.inner.y}
			/>
			{#if tick.major}
				<text x={tick.label.x} y={tick.label.y}>{String(tick.ev).replace('-', '−')}</text>
			{/if}
		{/each}
		<line
			class="needle"
			style:transform="rotate({needle}deg)"
			style:transform-origin="{PIVOT.x}px {PIVOT.y}px"
			x1={PIVOT.x}
			y1={PIVOT.y}
			x2={PIVOT.x}
			y2={PIVOT.y - SCALE_R - 4}
		/>
	</svg>
	<span class="readout mono">
		<span>{reading}</span>{#if lowLight}<span class="low">Low light</span>{/if}
	</span>
</div>

<style>
	.meter {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		width: 216px;
	}
	svg {
		display: block;
		width: 100%;
		overflow: hidden;
	}
	.scale,
	.band {
		fill: none;
	}
	.scale {
		stroke: var(--line-strong);
		stroke-width: 1;
	}
	.band {
		stroke: var(--accent);
		stroke-width: 4;
	}
	line {
		stroke: var(--ink-dim);
		stroke-width: 1;
	}
	line.major {
		stroke: var(--ink);
	}
	line.sill {
		stroke: var(--line-strong);
	}
	text {
		fill: var(--ink-dim);
		font-family: var(--mono);
		font-size: 10px;
		text-anchor: middle;
		dominant-baseline: central;
	}
	/* swings past its reading and settles, like a needle on a spring */
	.needle {
		stroke: #ff4d3a;
		stroke-width: 1.5;
		stroke-linecap: round;
		transition: transform 0.9s cubic-bezier(0.34, 1.36, 0.64, 1);
	}
	.readout {
		color: var(--ink);
		white-space: nowrap;
	}
	.low {
		margin-left: 1.2ch;
		color: var(--accent);
	}
</style>
