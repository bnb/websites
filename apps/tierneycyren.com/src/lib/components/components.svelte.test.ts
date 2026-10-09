import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { MIXES } from '../fixtures';
import type { Mix as MixData } from '../types';
import Masthead from './Masthead.svelte';
import Mix from './Mix.svelte';
import MixList from './MixList.svelte';
import SiteFooter from './SiteFooter.svelte';

// no network in tests: covers become blank, audio never loads (preload="none")
const mixes: MixData[] = MIXES.map((mix) => ({ ...mix, image: '' }));

const SPACE = /\s+/g;
const text = (element: Element | null | undefined) =>
	element?.textContent?.replace(SPACE, ' ').trim();

describe('Masthead', () => {
	it('sets the name as the page heading, with the bio', async () => {
		await render(Masthead, { bio: 'girl rave dj in bushwick' });
		await expect
			.element(page.getByRole('heading', { level: 1 }))
			.toHaveTextContent('tierney cyren');
		await expect.element(page.getByText('girl rave dj in bushwick')).toBeInTheDocument();
	});

	it('falls back to a bio of its own', async () => {
		await render(Masthead, { bio: '' });
		await expect.element(page.getByText('girl rave dj', { exact: true })).toBeInTheDocument();
	});
});

describe('Mix', () => {
	it('shows the title, running time, date, format and description, with a lazy player', async () => {
		const { container } = await render(Mix, { mix: mixes[0], number: '02' });
		await expect
			.element(page.getByRole('heading', { level: 3 }))
			.toHaveTextContent("one shot: I promise it's techno");
		expect(container.querySelector('article')?.getAttribute('aria-labelledby')).toBe(
			container.querySelector('h3')?.id
		);
		const times = Array.from(container.querySelectorAll('time'), (t) => [
			t.textContent,
			t.dateTime
		]);
		expect(times).toEqual([
			['22:15', 'PT22M15S'],
			['Sep 1, 2026', '2026-09-01T15:40:29.655455Z']
		]);
		expect(container.querySelector('.meta')?.textContent).toContain('WAV');
		expect(container.querySelector('.description')?.textContent).toContain('this one');

		const audio = container.querySelector('audio')!;
		expect(audio.preload).toBe('none');
		expect(audio.getAttribute('aria-label')).toBe("Play one shot: I promise it's techno");
		expect(Array.from(audio.querySelectorAll('source'), (s) => s.type)).toEqual(['audio/wav']);
		expect(container.querySelector('.n')?.textContent).toBe('02');
	});

	it('leaves out what a mix doesn’t have', async () => {
		const bare: MixData = {
			...mixes[1],
			duration: 0,
			date: '',
			format: '',
			mimeType: '',
			description: ''
		};
		const { container } = await render(Mix, { mix: bare, number: '01' });
		expect(container.querySelectorAll('time')).toHaveLength(0);
		expect(container.querySelector('.description')).toBeNull();
		expect(container.querySelector('source')?.hasAttribute('type')).toBe(false);
	});

	it('shows the cover when there is one', async () => {
		const cover: MixData = {
			...mixes[1],
			image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E'
		};
		const { container } = await render(Mix, { mix: cover, number: '01' });
		const img = container.querySelector('img')!;
		expect(img.getAttribute('alt')).toBe('');
		expect(img.loading).toBe('lazy');
	});

	it('loads the first cover eagerly, resized, with the original as the fallback', async () => {
		const original = 'https://images.plyr.fm/images/cover.png';
		const { container } = await render(Mix, {
			mix: { ...mixes[1], image: original },
			number: '01',
			priority: true
		});
		const img = container.querySelector('img')!;
		expect(img.loading).toBe('eager');
		expect(img.getAttribute('fetchpriority')).toBe('high');
		expect(img.getAttribute('src')).toBe(
			'https://images.plyr.fm/cdn-cgi/image/width=600,format=auto/images/cover.png'
		);
		expect(img.getAttribute('srcset')).toContain('width=1200,format=auto/images/cover.png 1200w');
	});
});

describe('MixList', () => {
	it('counts the mixes and their running time, newest numbered highest', async () => {
		const { container } = await render(MixList, { mixes });
		await expect.element(page.getByRole('heading', { level: 2 })).toHaveTextContent('Mixes');
		expect(text(container.querySelector('.head p'))).toBe('2 mixes · 1 hr 19 min');
		expect(Array.from(container.querySelectorAll('.n'), (n) => n.textContent)).toEqual([
			'02',
			'01'
		]);
	});

	it('says "mix" for one', async () => {
		const { container } = await render(MixList, { mixes: mixes.slice(1) });
		expect(text(container.querySelector('.head p'))).toBe('1 mix · 57 min');
	});

	it('plays one mix at a time', async () => {
		const { container } = await render(MixList, { mixes });
		const [first, second] = [...container.querySelectorAll('audio')];
		let paused = false;
		first.pause = () => {
			paused = true;
		};
		first.dispatchEvent(new Event('play'));
		second.dispatchEvent(new Event('play'));
		expect(paused).toBe(true);
	});

	it('has an empty state and an outage state, both pointing at plyr.fm', async () => {
		const empty = await render(MixList, { mixes: [] });
		expect(empty.container.querySelector('.state')?.textContent).toContain('No mixes up yet.');
		expect(empty.container.querySelector('.state a')?.getAttribute('href')).toBe(
			'https://plyr.fm/u/bnb.im'
		);

		const down = await render(MixList, { mixes: [], loadError: true });
		expect(down.container.querySelector('.state')?.textContent).toContain(
			"Couldn't reach the AT\u00a0Protocol right now."
		);
	});
});

describe('SiteFooter', () => {
	it('lists the mixes summary, and no social accounts', async () => {
		const { container } = await render(SiteFooter, { mixes: '2 mixes · 1 hr 19 min' });
		expect(Array.from(container.querySelectorAll('dt'), (dt) => dt.textContent)).toEqual(['Mixes']);
		expect(container.querySelector('a.out')).toBeNull();
		await expect
			.element(page.getByRole('link', { name: 'Back to top' }))
			.toHaveAttribute('href', '#top');
	});

	it('leaves the facts out when there are no mixes', async () => {
		const { container } = await render(SiteFooter, {});
		expect(container.querySelector('dl')).toBeNull();
	});
});
