<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import { onFrame } from '../audio';

	/** how many bars, low to high; each takes 60% of its slot, the resting ticks too */
	const BANDS = 64;

	// While a mix plays, the bars dance on a canvas over the resting ticks; when
	// it stops the canvas clears and the ticks (plain CSS, so they're there
	// without JavaScript and for reduced motion) are all that's left.
	const draw: Attachment<HTMLCanvasElement> = (canvas) => {
		const context = canvas.getContext('2d');
		if (!context) return;
		let width = 0;
		let height = 0;
		let fill: CanvasGradient | undefined;

		const size = () => {
			width = canvas.clientWidth;
			height = canvas.clientHeight;
			canvas.width = Math.round(width * devicePixelRatio);
			canvas.height = Math.round(height * devicePixelRatio);
			context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
			// the theme's colours, read through color properties (see the CSS)
			const style = getComputedStyle(canvas);
			fill = context.createLinearGradient(0, height, 0, 0);
			fill.addColorStop(0, style.color);
			fill.addColorStop(1, style.textDecorationColor);
		};
		size();
		const resize = new ResizeObserver(size);
		resize.observe(canvas);

		const stop = onFrame((frame) => {
			context.clearRect(0, 0, width, height);
			if (!frame || !fill) return;
			const slot = width / BANDS;
			context.fillStyle = fill;
			frame.levels.forEach((level, i) => {
				const bar = Math.max(2, level * height);
				context.fillRect(i * slot, height - bar, slot * 0.6, bar);
			});
		}, BANDS);

		return () => {
			stop();
			resize.disconnect();
		};
	};
</script>

<div class="spectrum" aria-hidden="true" style:--bands={BANDS}>
	<canvas {@attach draw}></canvas>
</div>

<style>
	.spectrum {
		height: 28px;
		margin-top: 6px;
		background: repeating-linear-gradient(
				to right,
				color-mix(in srgb, var(--accent) 45%, transparent) 0 calc(60% / var(--bands)),
				transparent 0 calc(100% / var(--bands))
			)
			0 100% / 100% 2px no-repeat;
	}
	canvas {
		display: block;
		width: 100%;
		height: 100%;
		/* the bars' gradient, bottom to top; computed colours always parse */
		color: var(--accent);
		text-decoration-color: var(--highlight);
	}
</style>
