<script lang="ts">
	import { resilient } from '@bnb/ui';
	import type { Attachment } from 'svelte/attachments';
	import { on } from 'svelte/events';
	import { isoDuration, lengthScale, postedDate, runningTime } from '../format';
	import { angleAround, scrub, turnBetween } from '../platter';
	import { deck, player, toggle } from '../player.svelte';
	import { coverAt } from '../plyr';
	import type { Mix } from '../types';
	import Record from './Record.svelte';

	let {
		mix,
		number,
		longest = 0,
		priority = false
	}: {
		mix: Mix;
		/** two digits, counting up from the oldest mix */
		number: string;
		/** seconds: the longest mix on the page, which sets the scale every length is drawn to */
		longest?: number;
		/** the first cover on the page: load it eagerly (it's the largest paint on a phone) */
		priority?: boolean;
	} = $props();

	const id = $props.id();
	const length = $derived(runningTime(mix.duration));
	const posted = $derived(postedDate(mix.date));
	const scale = $derived(lengthScale(mix.duration, longest));

	let audio = $state<HTMLAudioElement>();
	/** degrees the record has been turned by hand */
	let turn = $state(0);
	/** where a drag on the record will land, while it's being dragged */
	let cue = $state<number | null>(null);

	const onDeck = $derived(player.mix?.uri === mix.uri);
	const progress = $derived(cue ?? (onDeck ? player.time : null));

	/** below this much turning, a press on the record is a tap: play or pause */
	const TAP_DEGREES = 4;

	// The record is a jog wheel: drag it round to scrub (a turn is a minute),
	// tap it to play or pause. Pointer only; the audio controls do the same from
	// the keyboard. touch-action: pan-y keeps the page scrolling past it on phones.
	const platter: Attachment<HTMLElement> = (node) => {
		let last: number | null = null;
		let turned = 0;
		let target = 0;

		const angle = (event: PointerEvent) => {
			const box = node.getBoundingClientRect();
			return angleAround(
				event.clientX,
				event.clientY,
				box.left + box.width / 2,
				box.top + box.height / 2
			);
		};
		const down = (event: PointerEvent) => {
			if (event.button !== 0 || !audio) return;
			node.setPointerCapture(event.pointerId);
			last = angle(event);
			turned = 0;
			target = audio.currentTime;
		};
		const move = (event: PointerEvent) => {
			if (last === null) return;
			const next = angle(event);
			const degrees = turnBetween(last, next);
			last = next;
			turn += degrees;
			turned += Math.abs(degrees);
			target = scrub(target, degrees, mix.duration);
			if (turned >= TAP_DEGREES) cue = target;
		};
		const up = () => {
			if (last === null || !audio) return;
			last = null;
			if (cue === null) toggle(audio);
			else audio.currentTime = cue;
			cue = null;
		};
		const cancel = () => {
			last = null;
			cue = null;
		};

		const off = [
			on(node, 'pointerdown', down),
			on(node, 'pointermove', move),
			on(node, 'pointerup', up),
			on(node, 'pointercancel', cancel)
		];
		return () => {
			for (const remove of off) remove();
		};
	};
</script>

<article class="mix" class:live={onDeck && player.playing} aria-labelledby={id}>
	<div class="cover">
		<Record
			spinning={onDeck && player.playing}
			arm={onDeck ? 'down' : 'rest'}
			{turn}
			{@attach platter}
		>
			{#if mix.image}
				<!-- resized covers, falling back to the original if resizing fails -->
				<img
					src={coverAt(mix.image, 600)}
					srcset="{coverAt(mix.image, 400)} 400w, {coverAt(mix.image, 600)} 600w, {coverAt(
						mix.image,
						1200
					)} 1200w"
					sizes="(max-width: 640px) min(216px, 60vw), 168px"
					alt=""
					width="600"
					height="600"
					loading={priority ? 'eager' : 'lazy'}
					fetchpriority={priority ? 'high' : 'auto'}
					decoding="async"
					draggable="false"
					{@attach resilient([mix.image])}
				/>
			{/if}
		</Record>
		<span class="n" aria-hidden="true">{number}</span>
	</div>

	<div class="body">
		<h3 {id}>{mix.title}</h3>
		<p class="meta mono">
			{#if length}<span>Length <time datetime={isoDuration(mix.duration)}>{length}</time></span>{/if}
			{#if posted}<span>Posted <time datetime={mix.date}>{posted}</time></span>{/if}
			{#if mix.format}<span>{mix.format}</span>{/if}
		</p>
		{#if scale}
			<!-- its length to scale with the others (the longest fills the line), ticked
			     every ten minutes; the playhead marks where it's at -->
			<div class="scale" aria-hidden="true" style:--ticks="{(600 / longest) * 100}%">
				<span class="fill" style:width="{scale * 100}%">
					{#if progress !== null}
						<span class="playhead" style:left="{Math.min(progress / mix.duration, 1) * 100}%"></span>
					{/if}
				</span>
			</div>
		{/if}
		{#if mix.description}
			<p class="description">{mix.description}</p>
		{/if}
		<!-- preload="none": a mix is an hour of audio, fetched only once it plays.
		     Each source is tried in turn, so a CDN miss falls back to the PDS.
		     crossorigin: both sources send CORS headers, so the lasers can hear it. -->
		<audio
			bind:this={audio}
			controls
			preload="none"
			crossorigin="anonymous"
			aria-label="Play {mix.title}"
			{@attach deck(mix)}
		>
			{#each mix.sources as src (src)}<source {src} type={mix.mimeType || undefined} />{/each}
			<a href={mix.sources[0]}>Download {mix.title}</a>
		</audio>
	</div>
</article>

<style>
	.mix {
		display: grid;
		grid-template-columns: minmax(120px, 280px) 1fr;
		gap: clamp(16px, 3vw, 40px);
		align-items: start;
		transition: --energy 0.6s var(--ease);
	}
	/* the playing mix's title glows brighter (see the blacklight in app.css) */
	.live {
		--energy: 0.8;
	}

	.cover {
		position: relative;
	}
	.cover :global(.record) {
		cursor: grab;
		touch-action: pan-y;
		user-select: none;
	}
	.cover :global(.record:active) {
		cursor: grabbing;
	}
	.n {
		position: absolute;
		left: 0;
		bottom: 0;
		padding: 6px 10px 4px;
		background: var(--bg);
		color: var(--accent);
		font-size: clamp(28px, 3.4vw, 48px);
		font-weight: 900;
		font-stretch: 62%;
		line-height: 1;
	}

	.body {
		display: grid;
		gap: 14px;
		min-width: 0;
	}
	h3 {
		font-size: clamp(32px, 5.4vw, 84px);
		font-weight: 900;
		font-stretch: 62%;
		line-height: 0.86;
		letter-spacing: -0.005em;
		text-transform: uppercase;
		overflow-wrap: anywhere;
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 20px;
		color: var(--ink-dim);
	}
	.meta time {
		color: var(--ink);
	}

	.scale {
		position: relative;
		max-width: 640px;
		height: 12px;
		background:
			repeating-linear-gradient(
					to right,
					var(--line-strong) 0 1px,
					transparent 1px var(--ticks)
				)
				0 100% / 100% 5px no-repeat,
			linear-gradient(var(--line), var(--line)) 0 100% / 100% 1px no-repeat;
	}
	.fill {
		position: absolute;
		left: 0;
		bottom: 0;
		height: 5px;
		background: var(--accent);
		box-shadow: 0 0 12px color-mix(in srgb, var(--accent) 45%, transparent);
	}
	.playhead {
		position: absolute;
		bottom: -3px;
		width: 3px;
		height: 15px;
		margin-left: -1.5px;
		background: var(--highlight);
		box-shadow: 0 0 10px var(--highlight);
	}

	.description {
		max-width: 60ch;
		color: var(--ink-dim);
		font-size: 17px;
		line-height: 1.55;
		white-space: pre-line;
	}
	audio {
		width: 100%;
		max-width: 640px;
		margin-top: 6px;
		accent-color: var(--accent);
	}

	@media (max-width: 640px) {
		.mix {
			grid-template-columns: 1fr;
		}
		.cover {
			max-width: 360px;
		}
	}
</style>
