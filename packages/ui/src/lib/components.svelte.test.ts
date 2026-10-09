import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import Fact from './Fact.svelte';
import Facts from './Facts.svelte';
import Seo from './Seo.svelte';
import Signoff from './Signoff.svelte';
import SiteRail from './SiteRail.svelte';
import SkipLink from './SkipLink.svelte';

const html = (markup: string) => createRawSnippet(() => ({ render: () => markup }));

describe('SkipLink (component)', () => {
	it('is hidden until focused, then in view', async () => {
		await render(SkipLink, { href: '#work', label: 'Skip to photographs' });
		const link = page.getByRole('link', { name: 'Skip to photographs' });
		await expect.element(link).toHaveAttribute('href', '#work');
		await expect.element(link).not.toBeInViewport();
		(link.element() as HTMLElement).focus();
		await expect.element(link).toBeInViewport();
	});
});

describe('SiteRail (component)', () => {
	const railLinks = () =>
		Array.from(
			page.getByRole('navigation', { name: "Tierney's sites" }).element().querySelectorAll('a'),
			(a) => [a.textContent, a.getAttribute('href'), a.getAttribute('aria-current')]
		);

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('links every site, with this one marked current and pointed home', async () => {
		vi.stubEnv('DEV', false);
		await render(SiteRail, { current: 'camera', children: html('<p>the page</p>') });

		expect(railLinks()).toEqual([
			['bnb.im', 'https://bnb.im', null],
			['tierney.camera', '/', 'true'],
			['tierneycyren.com', 'https://tierneycyren.com', null]
		]);
		await expect.element(page.getByText('the page')).toBeVisible();
	});

	it('links the other sites’ dev servers in development', async () => {
		vi.stubEnv('DEV', true);
		await render(SiteRail, { current: 'dj', children: html('<p>the page</p>') });

		expect(railLinks()).toEqual([
			['bnb.im', 'http://127.0.0.1:5174/', null],
			['tierney.camera', 'http://127.0.0.1:5173/', null],
			['tierneycyren.com', '/', 'true']
		]);
	});

	it('is a strip on top on phones and a rail down the side from 760px', async () => {
		const { container } = await render(SiteRail, { current: 'bnb', children: html('<p>x</p>') });
		const nav = container.querySelector('nav') as HTMLElement;
		const pageColumn = container.querySelector('.page') as HTMLElement;

		await page.viewport(390, 800);
		expect(nav.getBoundingClientRect().bottom).toBeLessThanOrEqual(
			pageColumn.getBoundingClientRect().top
		);

		await page.viewport(1024, 800);
		expect(nav.getBoundingClientRect().right).toBeLessThanOrEqual(
			pageColumn.getBoundingClientRect().left
		);
		expect(nav.getBoundingClientRect().width).toBe(72);
	});

	const latest = {
		bnb: { kind: 'post', title: 'Is MDM', date: '2026-10-02T00:00:00.000Z' },
		camera: { kind: 'photo', date: '2026-09-16T20:14:27.303Z' }
	};

	it('describes each other site’s link with its newest item', async () => {
		await render(SiteRail, { current: 'camera', latest, children: html('<p>x</p>') });
		const rail = page.getByRole('navigation', { name: "Tierney's sites" });

		// dated in UTC, so midnight doesn't slip back a day
		await expect
			.element(rail.getByRole('link', { name: 'bnb.im' }))
			.toHaveAccessibleDescription('Newest post: Is MDM, Oct 2, 2026');
		await expect
			.element(rail.getByRole('link', { name: 'tierney.camera' }))
			.not.toHaveAttribute('aria-describedby');
		await expect
			.element(rail.getByRole('link', { name: 'tierneycyren.com' }))
			.not.toHaveAttribute('aria-describedby');
	});

	it('opens a preview beside the rail on keyboard focus, which Escape closes', async () => {
		await page.viewport(1024, 800);
		await render(SiteRail, { current: 'dj', latest, children: html('<p>x</p>') });
		const link = page.getByRole('link', { name: 'bnb.im' });
		const preview = page.getByText('Newest post', { exact: true });
		await expect.element(preview).not.toBeVisible();

		await userEvent.tab();
		await expect.element(link).toHaveFocus();
		await expect.element(preview).toBeVisible();
		await expect.element(page.getByText('Oct 2, 2026', { exact: true })).toBeVisible();
		// beside the link, not over it, and out of the pointer's way
		const poster = preview.element().closest('[aria-hidden="true"]') as HTMLElement;
		expect(poster.getBoundingClientRect().left).toBeGreaterThan(
			link.element().getBoundingClientRect().right
		);
		expect(getComputedStyle(poster).pointerEvents).toBe('none');

		await userEvent.keyboard('{Escape}');
		await expect.element(preview).not.toBeVisible();
		await expect.element(link).toHaveFocus();

		await userEvent.tab();
		await expect.element(page.getByText('Newest photo', { exact: true })).toBeVisible();
	});

	it('opens a preview on hover, even without a newest item', async () => {
		await page.viewport(1024, 800);
		const { container } = await render(SiteRail, { current: 'bnb', children: html('<p>x</p>') });
		const poster = container.querySelector('.poster[data-site="dj"]') as HTMLElement;
		await expect.element(poster).not.toBeVisible();

		await userEvent.hover(page.getByRole('link', { name: 'tierneycyren.com' }));
		await expect.element(poster).toBeVisible();
		expect(poster.textContent?.trim()).toBe('Tierney Cyren');
	});

	it('shows tierney.camera’s newest photo in its preview, described by its alt text', async () => {
		await page.viewport(1024, 800);
		const photo = {
			kind: 'photo',
			image: {
				src: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
				alt: 'A rooftop',
				width: 3,
				height: 2
			},
			date: '2026-09-16T20:14:27.303Z'
		};
		const { container } = await render(SiteRail, {
			current: 'bnb',
			latest: { camera: photo },
			children: html('<p>x</p>')
		});
		const link = page.getByRole('link', { name: 'tierney.camera' });
		await expect.element(link).toHaveAccessibleDescription('Newest photo: A rooftop, Sep 16, 2026');

		await userEvent.hover(link);
		const img = container.querySelector('.poster[data-site="camera"] img') as HTMLImageElement;
		await expect.element(img).toBeVisible();
		expect(img.getAttribute('src')).toBe(photo.image.src);
		// sized by the photo's aspect ratio before it loads
		const box = img.getBoundingClientRect();
		expect(box.width / box.height).toBeCloseTo(3 / 2, 1);
	});

	it('keeps the previews off the phone strip', async () => {
		await page.viewport(390, 800);
		await render(SiteRail, { current: 'dj', latest, children: html('<p>x</p>') });
		await userEvent.tab();
		await expect.element(page.getByRole('link', { name: 'bnb.im' })).toHaveFocus();
		await expect.element(page.getByText('Newest post', { exact: true })).not.toBeVisible();
	});
});

describe('Signoff (component)', () => {
	it('can be hidden from assistive tech', async () => {
		const { container } = await render(Signoff, { text: 'tierney.camera', decorative: true });
		expect(container.querySelector('p')?.getAttribute('aria-hidden')).toBe('true');
	});

	it('is read out by default', async () => {
		const { container } = await render(Signoff, { text: ':)' });
		expect(container.querySelector('p')?.hasAttribute('aria-hidden')).toBe(false);
	});
});

describe('Facts (component)', () => {
	it('renders a definition list in either variant', async () => {
		const items = html('<div><dt>Based</dt><dd>New York City</dd></div>');
		const columns = await render(Facts, { children: items });
		expect(columns.container.querySelector('dl.facts.columns dd')?.textContent).toBe(
			'New York City'
		);

		const strip = await render(Facts, { variant: 'strip', children: items });
		expect(strip.container.querySelector('dl.facts.strip')).not.toBeNull();
	});
});

describe('Fact (component)', () => {
	it('pairs a term with its value', async () => {
		const { container } = await render(Fact, {
			term: 'Kit',
			children: html('<span>Sony α7R IV</span>')
		});
		expect(container.querySelector('dt')?.textContent).toBe('Kit');
		expect(container.querySelector('dd')?.textContent).toBe('Sony α7R IV');
	});
});

const meta = (selector: string) => document.head.querySelector(selector)?.getAttribute('content');

describe('Seo (component)', () => {
	it('writes only the tags it is given', async () => {
		await render(Seo, {
			title: 'A post',
			description: 'About it',
			url: 'https://bnb.im/posts/a/',
			image: 'https://bnb.im/img/social/a.png',
			imageWidth: 1200,
			imageHeight: 630,
			twitterCard: 'summary_large_image',
			twitterCreator: '@bitandbang',
			twitterImage: true
		});
		expect(document.title).toBe('A post');
		expect(meta('meta[name="description"]')).toBe('About it');
		expect(meta('meta[property="og:url"]')).toBe('https://bnb.im/posts/a/');
		expect(meta('meta[name="twitter:image"]')).toBe('https://bnb.im/img/social/a.png');
		expect(meta('meta[property="og:image:width"]')).toBe('1200');
		expect(meta('meta[name="twitter:creator"]')).toBe('@bitandbang');
		expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
		expect(document.head.querySelector('meta[property="og:type"]')).toBeNull();
	});

	it('leaves out twitter:image and dimensions unless given', async () => {
		await render(Seo, { title: 'Home', image: 'https://bnb.im/img/small-card.png' });
		expect(meta('meta[property="og:image"]')).toBe('https://bnb.im/img/small-card.png');
		expect(document.head.querySelector('meta[name="twitter:image"]')).toBeNull();
		expect(document.head.querySelector('meta[property="og:image:width"]')).toBeNull();
		expect(document.head.querySelector('meta[name="description"]')).toBeNull();
	});

	it('writes canonical, type and site name when asked', async () => {
		await render(Seo, {
			title: 'tierney cyren · photography',
			canonical: 'https://tierney.camera/',
			type: 'website',
			siteName: 'tierney.camera'
		});
		expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
			'https://tierney.camera/'
		);
		expect(meta('meta[property="og:type"]')).toBe('website');
		expect(meta('meta[property="og:site_name"]')).toBe('tierney.camera');
	});
});
