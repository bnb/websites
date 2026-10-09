import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { listen } from '../audio';
import Masthead from './Masthead.svelte';
import Spectrum from './Spectrum.svelte';

const ANGLE = /^-?[\d.]+deg$/;

// Web Audio, faked as little as possible: an analyser that reports whatever
// `level` is in every bin. Everything downstream (the loop, the lasers, the
// spectrum, the strobe) is the real thing.
const sound = vi.hoisted(() => ({ level: 0, contexts: 0 }));

class FakeContext {
	sampleRate = 48_000;
	destination = {};
	constructor() {
		sound.contexts++;
	}
	resume = async () => {};
	createMediaElementSource = () => ({ connect: () => {} });
	createAnalyser = () => ({
		fftSize: 2048,
		frequencyBinCount: 1024,
		connect: () => {},
		getByteFrequencyData: (bins: Uint8Array) => bins.fill(sound.level)
	});
}

/** An <audio> that reports itself playing or paused, with nothing to load. */
function deck() {
	const audio = document.createElement('audio');
	let paused = true;
	Object.defineProperty(audio, 'paused', { get: () => paused });
	return {
		audio,
		play: () => {
			paused = false;
			listen(audio);
		},
		stop: () => {
			paused = true;
		}
	};
}

const frames = (count = 3) =>
	new Promise<void>((resolve) => {
		const next = (left: number) => (left ? requestAnimationFrame(() => next(left - 1)) : resolve());
		next(count);
	});

const energyOf = (container: HTMLElement) =>
	container.querySelector<HTMLElement>('.masthead')!.style.getPropertyValue('--energy');

/** How much of the spectrum canvas has been drawn on, 0–1. */
function painted(container: HTMLElement) {
	const canvas = container.querySelector('canvas')!;
	const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
	let lit = 0;
	for (let i = 3; i < data.length; i += 4) if (data[i]) lit++;
	return lit / (data.length / 4);
}

describe('the visuals', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it('stay still for reduced motion, without touching Web Audio', async () => {
		vi.stubGlobal('AudioContext', FakeContext);
		vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
		const { container } = await render(Masthead, { bio: '' });
		const { play } = deck();
		sound.level = 255;
		play();
		await frames();
		expect(sound.contexts).toBe(0);
		expect(energyOf(container)).toBe('');
	});

	it('pulse the lasers, draw the spectrum and strobe on a drop while a mix plays', async () => {
		vi.stubGlobal('AudioContext', FakeContext);
		const errors: unknown[] = [];
		const onError = (event: ErrorEvent) => errors.push(event.error);
		window.addEventListener('error', onError);
		const masthead = await render(Masthead, { bio: '' });
		const spectrum = await render(Spectrum);
		const wash = masthead.container.querySelector<HTMLElement>('.wash')!;
		const { play, stop } = deck();

		// a quiet intro: the lasers barely move, nothing flashes
		sound.level = 40;
		play();
		await frames(10);
		expect(sound.contexts).toBe(1);
		const quiet = Number(energyOf(masthead.container));
		expect(quiet).toBeGreaterThan(0);
		expect(quiet).toBeLessThan(0.3);
		expect(wash.getAnimations()).toHaveLength(0);
		expect(painted(spectrum.container)).toBeGreaterThan(0);

		// the drop: the lasers jump and the wash flashes once
		sound.level = 250;
		await frames(4);
		expect(Number(energyOf(masthead.container))).toBeGreaterThan(0.8);
		expect(
			masthead.container.querySelector<HTMLElement>('.masthead')!.style.getPropertyValue('--sweep')
		).toMatch(ANGLE);
		expect(wash.getAnimations()).toHaveLength(1);
		const loud = painted(spectrum.container);
		expect(loud).toBeGreaterThan(0.5);

		// the music stops: everything settles
		stop();
		await frames(2);
		expect(energyOf(masthead.container)).toBe('');
		expect(painted(spectrum.container)).toBe(0);
		window.removeEventListener('error', onError);
		expect(errors).toEqual([]);
	});
});
