<script lang="ts">
	import { BigName } from '@bnb/ui';
	import type { Attachment } from 'svelte/attachments';
	import { onFrame } from '../audio';
	import { player } from '../player.svelte';
	import { FALLBACK_BIO, NAME } from '../site';

	let { bio }: { bio: string } = $props();

	const lines = NAME.split(' ');

	let wash = $state<HTMLElement>();

	// While a mix plays, the lasers pulse with the bass (--energy, which also
	// brightens the name's glow) and sweep faster the harder it hits (--sweep).
	// Big hits flash a faint magenta wash, never more than three times a second.
	// When the music stops, the properties go and the CSS rests.
	const lasers: Attachment<HTMLElement> = (node) => {
		let phase = 0;
		return onFrame((frame) => {
			if (!frame) {
				node.style.removeProperty('--energy');
				return;
			}
			const { energy, hit } = frame;
			phase += 0.012 + energy * 0.03;
			node.style.setProperty('--energy', energy.toFixed(3));
			node.style.setProperty('--sweep', `${(Math.sin(phase) * 9).toFixed(2)}deg`);
			if (hit) {
				wash?.animate([{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0 }], {
					duration: 220,
					easing: 'ease-out'
				});
			}
		});
	};
</script>

<section class="masthead" class:live={player.playing} aria-label="tierney cyren, DJ" {@attach lasers}>
	<!-- laser fans behind the name, and the strobe's wash; decoration only -->
	<div class="lasers" aria-hidden="true"></div>
	<div class="wash" aria-hidden="true" bind:this={wash}></div>
	<p class="kicker mono"><span>DJ</span></p>
	<BigName {lines} accent="last" />
	<p class="bio mono">{bio || FALLBACK_BIO}</p>
</section>

<style>
	.masthead {
		position: relative;
		display: grid;
		gap: clamp(16px, 2vw, 28px);
		padding: clamp(28px, 4vw, 56px) var(--pad) clamp(32px, 5vw, 72px);
		overflow: hidden;
		isolation: isolate;
	}
	/* playing without the analyser (reduced motion, or a browser that won't
	   start Web Audio): a steady glow instead of a pulse */
	.live {
		--energy: 0.5;
	}

	/* --energy and --sweep are registered in app.css, resting at 0 */
	.lasers {
		position: absolute;
		inset: 0;
		z-index: -1;
		background:
			repeating-conic-gradient(
				from calc(200deg + var(--sweep)) at 108% 112%,
				transparent 0deg 7deg,
				color-mix(in srgb, var(--highlight) calc(22% + var(--energy) * 40%), transparent) 7deg
					calc(7.4deg + var(--energy) * 0.3deg)
			),
			repeating-conic-gradient(
				from calc(110deg - var(--sweep)) at -8% 112%,
				transparent 0deg 9deg,
				color-mix(in srgb, var(--accent) calc(16% + var(--energy) * 36%), transparent) 9deg
					calc(9.3deg + var(--energy) * 0.3deg)
			);
		mask-image: linear-gradient(to bottom, transparent, black 30%, black 70%, transparent);
	}

	/* low and short: a tint over the dark masthead, not a white-out */
	.wash {
		position: absolute;
		inset: 0;
		z-index: -1;
		background: radial-gradient(
			ellipse at 50% 100%,
			color-mix(in srgb, var(--highlight) 22%, transparent),
			transparent 70%
		);
		opacity: 0;
		pointer-events: none;
	}

	.kicker span {
		display: inline-block;
		padding: 4px 10px;
		background: var(--highlight);
		color: var(--highlight-ink);
		font-weight: 500;
	}

	.masthead > :global(.big-name) {
		/* tall condensed type: let the last line hang off nothing */
		margin-block: -0.04em;
	}

	.bio {
		max-width: 40ch;
		font-size: 13px;
		line-height: 1.7;
		letter-spacing: 0.06em;
		color: var(--ink-dim);
	}

	@media (prefers-reduced-motion: reduce) {
		.wash {
			display: none;
		}
	}
</style>
