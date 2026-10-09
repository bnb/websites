import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import Page from '../../routes/+page.svelte';
import { MIXES } from '../fixtures';
import type { Mix as MixData } from '../types';
import Mix from './Mix.svelte';
import NowPlaying from './NowPlaying.svelte';

// no network in tests: covers become blank, and each <audio> gets a stand-in
// clock (an element with nothing loaded can't play or seek)
const mixes: MixData[] = MIXES.map((mix) => ({ ...mix, image: '' }));
const [techno, live] = mixes;

/** Makes an <audio> play, pause and seek as if it had its file. */
function playable(audio: HTMLAudioElement) {
	let time = 0;
	let paused = true;
	Object.defineProperties(audio, {
		currentTime: {
			get: () => time,
			set: (to: number) => {
				time = to;
				audio.dispatchEvent(new Event('timeupdate'));
			}
		},
		paused: { get: () => paused },
		play: {
			value: async () => {
				paused = false;
				audio.dispatchEvent(new Event('play'));
			}
		},
		pause: {
			value: () => {
				paused = true;
				audio.dispatchEvent(new Event('pause'));
			}
		}
	});
	return audio;
}

async function renderPage() {
	const { container } = await render(Page, {
		data: { bio: '', profile: null, mixes, pds: '', loadError: false },
		params: {}
	} as never);
	const [first, second] = Array.from(container.querySelectorAll('audio'), playable);
	return { container, first, second };
}

const bar = () => page.getByRole('region', { name: 'Now playing' });

describe('the now-playing bar', () => {
	it('stays away until a mix plays, then follows it', async () => {
		const { first, second } = await renderPage();
		await expect.element(bar()).not.toBeInTheDocument();

		await first.play();
		await expect.element(bar()).toBeVisible();
		await expect
			.element(bar().getByRole('button', { name: "Pause one shot: I promise it's techno" }))
			.toBeVisible();
		await expect
			.element(bar().getByRole('status'))
			.toHaveTextContent("Now playing: one shot: I promise it's techno");
		first.currentTime = 65;
		await expect.element(bar().getByText('1:05')).toBeVisible();
		await expect.element(bar().getByText('22:15')).toBeVisible();

		// its button pauses the mix, and plays it again
		await bar().getByRole('button').click();
		expect(first.paused).toBe(true);
		await bar().getByRole('button', { name: "Play one shot: I promise it's techno" }).click();
		expect(first.paused).toBe(false);

		// one mix at a time: starting another stops the first and takes over the bar
		await second.play();
		expect(first.paused).toBe(true);
		await expect
			.element(bar().getByRole('status'))
			.toHaveTextContent('Now playing: tierney cyren @ tachycardia 028');
	});

	it('scrolls a title only when it’s too long for the bar', async () => {
		const props = { playing: true, time: 0, duration: 60, ontoggle: () => {} };
		await page.viewport(1200, 600);
		const long = { ...techno, title: 'a very long title '.repeat(12) };
		const { container, rerender } = await render(NowPlaying, { ...props, mix: long });
		await expect.poll(() => container.querySelectorAll('.run').length).toBe(2);
		// the copy is for the eye only
		expect(container.querySelectorAll('.run[aria-hidden="true"]')).toHaveLength(1);

		await rerender({ ...props, mix: techno });
		await expect.poll(() => container.querySelectorAll('.run').length).toBe(1);
	});
});

describe('lock-screen controls', () => {
	afterEach(() => vi.restoreAllMocks());

	it('describe the mix and drive the player', async () => {
		const handlers = new Map<MediaSessionAction, MediaSessionActionHandler | null>();
		vi.spyOn(navigator.mediaSession, 'setActionHandler').mockImplementation((action, handler) => {
			handlers.set(action, handler);
		});
		const { first } = await renderPage();
		await first.play();

		expect(navigator.mediaSession.metadata?.title).toBe("one shot: I promise it's techno");
		expect(navigator.mediaSession.metadata?.artist).toBe('tierney cyren');
		expect(navigator.mediaSession.playbackState).toBe('playing');

		const act = (action: MediaSessionAction, details: Partial<MediaSessionActionDetails> = {}) =>
			handlers.get(action)?.({ action, ...details });
		act('seekto', { seekTime: 600 });
		expect(first.currentTime).toBe(600);
		act('seekforward');
		expect(first.currentTime).toBe(610);
		act('seekbackward', { seekOffset: 30 });
		expect(first.currentTime).toBe(580);
		// never past either end
		act('seekto', { seekTime: 99_999 });
		expect(first.currentTime).toBe(1335);
		act('seekbackward', { seekOffset: 99_999 });
		expect(first.currentTime).toBe(0);

		act('pause');
		expect(first.paused).toBe(true);
		expect(navigator.mediaSession.playbackState).toBe('paused');
		act('play');
		expect(first.paused).toBe(false);
	});
});

describe('set lengths to scale', () => {
	it('draws each mix against the longest, with a playhead on the one playing', async () => {
		const { container, first } = await renderPage();
		const fills = [...container.querySelectorAll<HTMLElement>('.scale .fill')];
		expect(fills.map((fill) => fill.style.width)).toEqual(['38.9213%', '100%']);
		expect(container.querySelector('.playhead')).toBeNull();

		await first.play();
		first.currentTime = 1335 / 2;
		await expect
			.poll(() => container.querySelector<HTMLElement>('.playhead')?.style.left)
			.toBe('50%');
		expect(container.querySelectorAll('.playhead')).toHaveLength(1);
	});

	it('leaves the bar off a mix of unknown length', async () => {
		const { container } = await render(Mix, {
			mix: { ...live, duration: 0 },
			number: '01',
			longest: 3430
		});
		expect(container.querySelector('.scale')).toBeNull();
	});
});

describe('the record', () => {
	/** A pointer event at a point on the record, by angle (0° is three o’clock) and radius (0–1). */
	function at(record: Element, type: string, degrees: number, radius = 0.8) {
		const box = record.getBoundingClientRect();
		const angle = (degrees * Math.PI) / 180;
		record.dispatchEvent(
			new PointerEvent(type, {
				bubbles: true,
				button: 0,
				pointerId: 1,
				clientX: box.left + (box.width / 2) * (1 + Math.cos(angle) * radius),
				clientY: box.top + (box.height / 2) * (1 + Math.sin(angle) * radius)
			})
		);
	}

	async function renderMix() {
		const { container } = await render(Mix, { mix: techno, number: '02', longest: 3430 });
		const record = container.querySelector('.record')!;
		// synthetic pointers can't be captured; real ones always can
		Object.defineProperty(record, 'setPointerCapture', { value: () => {} });
		return { container, record, audio: playable(container.querySelector('audio')!) };
	}

	it('spins with the arm down while its mix plays, and stops with the arm still on it', async () => {
		const { container, audio } = await renderMix();
		const disc = container.querySelector('.disc')!;
		const arm = container.querySelector('.arm')!;
		expect([disc.classList.contains('spinning'), arm.classList.contains('rest')]).toEqual([
			false,
			true
		]);

		await audio.play();
		await expect.poll(() => disc.classList.contains('spinning')).toBe(true);
		expect(arm.classList.contains('down')).toBe(true);

		audio.pause();
		await expect.poll(() => disc.classList.contains('spinning')).toBe(false);
		expect(arm.classList.contains('down')).toBe(true);
	});

	it('scrubs a minute a turn when dragged round, cueing the playhead as it goes', async () => {
		const { container, record, audio } = await renderMix();
		audio.currentTime = 100;

		at(record, 'pointerdown', 0);
		at(record, 'pointermove', 45);
		at(record, 'pointermove', 90);
		// a quarter turn clockwise: 15 seconds on, shown before it's let go
		await expect
			.poll(() => container.querySelector<HTMLElement>('.playhead')?.style.left)
			.toBe('8.61423%');
		expect(audio.currentTime).toBe(100);
		at(record, 'pointerup', 90);
		expect(audio.currentTime).toBe(115);

		// and back the other way, across the seam at nine o'clock
		at(record, 'pointerdown', -170);
		at(record, 'pointermove', 170);
		at(record, 'pointermove', 100);
		at(record, 'pointerup', 100);
		expect(audio.currentTime).toBeCloseTo(100);
	});

	it('plays or pauses with a tap, and lets a drag that’s cancelled (a scroll) go', async () => {
		const { container, record, audio } = await renderMix();
		at(record, 'pointerdown', 30);
		at(record, 'pointerup', 30);
		expect(audio.paused).toBe(false);
		at(record, 'pointerdown', 30);
		at(record, 'pointerup', 30);
		expect(audio.paused).toBe(true);

		at(record, 'pointerdown', 0);
		at(record, 'pointermove', 90);
		at(record, 'pointercancel', 90);
		at(record, 'pointerup', 90);
		expect([audio.currentTime, audio.paused]).toEqual([0, true]);
		// the playhead goes back to where the mix is, not where the drag had cued
		await expect
			.poll(() => container.querySelector<HTMLElement>('.playhead')?.style.left)
			.toBe('0%');
	});

	it('is hidden from assistive tech, which has the audio controls', async () => {
		const { record } = await renderMix();
		expect(record.getAttribute('aria-hidden')).toBe('true');
		await expect
			.element(page.getByLabelText("Play one shot: I promise it's techno"))
			.toHaveAttribute('controls');
	});
});
