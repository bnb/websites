import { bands, canFlash, energy, follow, isHit, settle } from './levels';

// One AudioContext for the page, with one AnalyserNode that every mix's <audio>
// feeds while it plays (only one plays at a time). A frame loop reads it and
// hands each frame to whatever is drawing: the lasers, the spectrum strip and
// the strobe. The loop runs only while a mix plays, the tab is visible and
// something is listening.
//
// The players have crossorigin="anonymous" and both of their sources (plyr.fm's
// CDN and the PDS) answer with access-control-allow-origin: *, so the analyser
// hears the music rather than silence.

/** One frame of the music, for the visuals. */
export interface Frame {
	/** bass level, smoothed, 0–1 */
	energy: number;
	/** the spectrum, as many bands as the listener asked for, low to high, 0–1 */
	levels: number[];
	/** a big bass hit the strobe may flash on (already capped at three a second) */
	hit: boolean;
}

/** Gets each frame, and null once when the music stops so the visuals can settle. */
type Listener = (frame: Frame | null) => void;

const listeners = new Map<Listener, number>();
/** elements already routed through the graph; an element can only be routed once */
const routed = new WeakSet<HTMLMediaElement>();

interface Graph {
	context: AudioContext;
	analyser: AnalyserNode;
	bins: Uint8Array<ArrayBuffer>;
}

let graph: Graph | undefined;
let current: HTMLMediaElement | undefined;
let raf = 0;
let then = 0;
let level = 0;
/** the bass level lately; unset until the first frame after the music starts */
let average: number | undefined;
let lastFlash: number | undefined;

const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const running = () =>
	!!current && !current.paused && routed.has(current) && !document.hidden && listeners.size > 0;

function tick(now: number) {
	raf = 0;
	if (!graph || !running()) {
		level = 0;
		for (const listener of listeners.keys()) listener(null);
		return;
	}
	const { context, analyser, bins } = graph;
	analyser.getByteFrequencyData(bins);
	const binHz = context.sampleRate / analyser.fftSize;
	const bass = energy(bins, binHz);
	level = follow(level, bass);
	// seeded from the first frame, so starting mid-track isn't a drop
	average = average === undefined ? bass : settle(average, bass, now - then);
	then = now;
	const hit = isHit(bass, average) && canFlash(lastFlash, now);
	if (hit) lastFlash = now;
	for (const [listener, count] of listeners) {
		listener({ energy: level, levels: count ? bands(bins, binHz, count) : [], hit });
	}
	raf = requestAnimationFrame(tick);
}

function start() {
	if (raf || !running()) return;
	then = performance.now();
	average = undefined;
	raf = requestAnimationFrame(tick);
}

function createGraph(): Graph {
	const context = new AudioContext();
	const analyser = context.createAnalyser();
	analyser.fftSize = 2048;
	analyser.smoothingTimeConstant = 0.7;
	// mastered dance music sits near the top of the default -100 to -30 dB
	// window, which pins every bar at full; this one leaves room to move
	analyser.minDecibels = -80;
	analyser.maxDecibels = -10;
	analyser.connect(context.destination);
	// the loop stops in a hidden tab; pick it back up on return
	document.addEventListener('visibilitychange', () => {
		if (document.hidden) return;
		void context.resume();
		start();
	});
	return { context, analyser, bins: new Uint8Array(analyser.frequencyBinCount) };
}

/**
 * Analyse `media` while it plays. Call it from the play event. The element is
 * routed through Web Audio only once the context is actually running: routed
 * into a context the browser keeps suspended (Safari, without a gesture), the
 * music would go silent, so then it's left alone and plays as it always did.
 * Nothing is analysed for reduced motion, since nothing would move.
 */
export function listen(media: HTMLMediaElement): void {
	if (calm()) return;
	current = media;
	const { context, analyser } = (graph ??= createGraph());
	context.resume().then(
		() => {
			if (!routed.has(media)) {
				context.createMediaElementSource(media).connect(analyser);
				routed.add(media);
			}
			start();
		},
		// a context that can't start: the element plays untouched
		() => {}
	);
}

/**
 * Get a frame of the music each animation frame while a mix plays, and null
 * when it stops. `count` is how many spectrum bands to read (0 for none).
 * Returns the unsubscribe.
 */
export function onFrame(listener: Listener, count = 0): () => void {
	listeners.set(listener, count);
	start();
	return () => listeners.delete(listener);
}
