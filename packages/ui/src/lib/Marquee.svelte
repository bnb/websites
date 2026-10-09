<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		items,
		separator = '/',
		fill = 14,
		label = 'the ticker',
		item
	}: {
		items: string[];
		/** set between items (and after the last); spaces in it are kept */
		separator?: string;
		/** repeat the items until one run holds at least this many, so it's wider than any screen */
		fill?: number;
		/** what the pause control calls the band: "Pause {label}" */
		label?: string;
		/** renders one item; plain text by default */
		item?: Snippet<[string]>;
	} = $props();

	const id = $props.id();

	// Two identical runs loop seamlessly by sliding the track left by exactly
	// half its width.
	const run = $derived(
		Array.from({ length: Math.ceil(fill / Math.max(items.length, 1)) }, () => items).flat()
	);
</script>

<!-- Pausable (WCAG 2.2.2), with or without JavaScript: the band is the label of
     a checkbox, so a click or tap anywhere on it pauses it, hovering pauses it,
     and keyboard users Tab to the checkbox, which shows itself on focus. The
     band's text is decorative; each site lists the same facts elsewhere. -->
<label class="marquee" for={id}>
	<span class="control">
		<input {id} type="checkbox" />
		<span>Pause {label}</span>
	</span>
	<span class="track" aria-hidden="true">
		{#each [0, 1] as copy (copy)}
			<span class="run">
				{#each run as value, i (i)}<span
						>{#if item}{@render item(value)}{:else}{value}{/if}</span
					><span class="sep">{separator}</span>{/each}
			</span>
		{/each}
	</span>
</label>

<style>
	/* Each theme tunes the band through --marquee-* tokens (see themes/*.css). */
	.marquee {
		position: relative;
		display: block;
		overflow: hidden;
		cursor: pointer;
		border-block: var(--marquee-border, 0);
		background: var(--marquee-bg, var(--accent));
		color: var(--marquee-ink, var(--accent-ink));
		font-family: var(--marquee-font, var(--display));
		font-size: var(--marquee-size, clamp(22px, 2.6cqi, 38px));
		font-weight: var(--marquee-weight, 800);
		font-stretch: var(--marquee-stretch, 75%);
		line-height: var(--marquee-leading, 1);
		letter-spacing: var(--marquee-tracking, 0.01em);
		text-transform: uppercase;
		white-space: nowrap;
	}

	.track {
		display: flex;
		width: max-content;
		padding: var(--marquee-pad, 14px 0);
		animation: marquee-slide var(--marquee-duration, 60s) linear infinite;
	}
	.marquee:hover .track,
	.marquee:has(input:checked) .track {
		animation-play-state: paused;
	}

	.run {
		display: flex;
	}
	.sep {
		padding: 0 var(--marquee-gap, 0.6em);
		white-space: pre;
	}

	/* visually hidden until it has keyboard focus, like a skip link */
	.control {
		position: absolute;
		z-index: 1;
		top: 50%;
		right: var(--pad, 16px);
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 14px;
		background: var(--bg);
		color: var(--accent);
		font-family: var(--mono);
		font-size: 12px;
		font-weight: 400;
		font-stretch: 100%;
		letter-spacing: 0.08em;
		line-height: 1.5;
		transform: translateY(-50%);
	}
	.control:not(:has(:focus-visible)) {
		width: 1px;
		height: 1px;
		padding: 0;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	input {
		margin: 0;
		accent-color: var(--accent);
	}

	@keyframes marquee-slide {
		to {
			transform: translateX(-50%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.track {
			animation: none;
		}
	}
</style>
