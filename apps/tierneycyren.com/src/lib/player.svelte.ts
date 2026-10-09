import type { Attachment } from 'svelte/attachments';
import { on } from 'svelte/events';
import { listen } from './audio';
import { sessionMetadata } from './session';
import type { Mix } from './types';

// What's playing, for everything on the page that reacts to it: the record in
// each mix, the lasers, the now-playing bar and the lock screen. Each mix's
// native <audio> is the real player; this follows it. Only the browser writes
// to it (from media events), so the server always renders the resting page.

export const player = $state({
	/** the mix on the deck: the last one started, playing or paused */
	mix: null as Mix | null,
	playing: false,
	/** seconds */
	time: 0,
	/** seconds, from the audio once it knows, else the record */
	duration: 0
});

/** the <audio> of the mix on the deck */
let deckAudio: HTMLAudioElement | null = null;

// a refused play() (autoplay rules) leaves it paused, which the controls already show
const play = (audio: HTMLMediaElement) => void audio.play().catch(() => {});

/** Play or pause a mix's audio (the one on the deck by default). */
export function toggle(audio = deckAudio): void {
	if (!audio) return;
	if (audio.paused) play(audio);
	else audio.pause();
}

/** Jump the deck's audio to `time` seconds, kept inside the mix. */
function seek(time: number) {
	if (!deckAudio) return;
	deckAudio.currentTime = Math.max(0, Math.min(time, player.duration || time));
}

const SESSION_ACTIONS: [MediaSessionAction, MediaSessionActionHandler][] = [
	['play', () => deckAudio && play(deckAudio)],
	['pause', () => deckAudio?.pause()],
	['seekbackward', ({ seekOffset }) => seek(player.time - (seekOffset ?? 10))],
	['seekforward', ({ seekOffset }) => seek(player.time + (seekOffset ?? 10))],
	['seekto', ({ seekTime }) => seek(seekTime ?? player.time)]
];

/** Lock-screen and media-key controls (Media Session API) for the mix on the deck. */
function announce(mix: Mix) {
	if (!('mediaSession' in navigator)) return;
	const session = navigator.mediaSession;
	session.metadata = new MediaMetadata(sessionMetadata(mix));
	for (const [action, handler] of SESSION_ACTIONS) {
		try {
			session.setActionHandler(action, handler);
		} catch {
			// a browser that doesn't know an action throws; the rest still work
		}
	}
}

function position() {
	if (!('mediaSession' in navigator)) return;
	navigator.mediaSession.playbackState = player.playing ? 'playing' : 'paused';
	if (!(player.duration > 0)) return;
	navigator.mediaSession.setPositionState({
		duration: player.duration,
		position: Math.min(player.time, player.duration),
		playbackRate: deckAudio?.playbackRate ?? 1
	});
}

/**
 * Attach to each mix's <audio>. Starting one stops whichever was playing (one
 * mix at a time), puts it on the deck and starts the analyser for the visuals.
 */
export function deck(mix: Mix): Attachment<HTMLAudioElement> {
	return (audio) => {
		const onDeck = () => deckAudio === audio;
		const sync = () => {
			if (!onDeck()) return;
			player.time = audio.currentTime;
			player.duration = Number.isFinite(audio.duration) ? audio.duration : mix.duration;
			position();
		};
		const onPlay = () => {
			if (deckAudio && !onDeck()) deckAudio.pause();
			deckAudio = audio;
			player.mix = mix;
			player.playing = true;
			announce(mix);
			sync();
			listen(audio);
		};
		const onPause = () => {
			if (!onDeck()) return;
			player.playing = false;
			sync();
		};
		const off = [
			on(audio, 'play', onPlay),
			on(audio, 'pause', onPause),
			on(audio, 'timeupdate', sync),
			on(audio, 'durationchange', sync)
		];
		return () => {
			for (const remove of off) remove();
			// a removed player stops, so take it off the deck
			if (!onDeck()) return;
			deckAudio = null;
			Object.assign(player, { mix: null, playing: false, time: 0, duration: 0 });
		};
	};
}
