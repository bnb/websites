import type { ComponentProps } from 'svelte';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import PostPage from './+page.svelte';

type PageData = ComponentProps<typeof PostPage>['data'];

const DOC = 'at://did:plc:uashgn65n5z7aqwk5cbuba5c/site.standard.document/3mtxb3lsy462t';
const PUB = 'at://did:plc:uashgn65n5z7aqwk5cbuba5c/site.standard.publication/3mtxb2uyta22l';

function data(extra: Partial<PageData> = {}): PageData {
	return {
		topics: [],
		atTags: [],
		latest: {},
		slug: 'jest',
		url: '/posts/jest/',
		title: 'Jest and the `--changedSince` flag',
		titleHtml: 'Jest and the <code>--changedSince</code> flag',
		description: "Getting Jest's --changedSince flag working on GitHub Actions CI.",
		date: '2020-04-09',
		dotDate: '09.04.2020',
		readingTime: 7,
		topic: 'GitHub Actions',
		series: undefined,
		tags: ['javascript', 'node'],
		html: '<h2 id="why" tabindex="-1">Why <a class="direct-link" href="#why" aria-hidden="true" tabindex="-1">#</a></h2>\n<p>Because <em>CI</em>.</p>\n',
		postTags: [
			{ name: 'at:canonical', content: DOC },
			{ rel: 'site.standard.document', href: DOC }
		],
		// an inline module stands in for the standard.site bundle
		subscribe: { publication: PUB, script: 'data:text/javascript,' },
		discussion: null,
		...extra
	};
}

const facts = (container: HTMLElement) =>
	Object.fromEntries(
		Array.from(container.querySelectorAll('.meta dl > div'), (div) => [
			div.querySelector('dt')?.textContent,
			div.querySelector('dd')?.textContent
		])
	);

describe('post page', () => {
	it('sets the title as HTML, so inline code shows', async () => {
		const { container } = await render(PostPage, { data: data() });
		const heading = page.getByRole('heading', { level: 1 });
		await expect.element(heading).toHaveTextContent('Jest and the --changedSince flag');
		expect(container.querySelector('h1.post-title code')?.textContent).toBe('--changedSince');
		await expect.element(page.getByRole('link', { name: '← Index' })).toHaveAttribute('href', '/');
	});

	it('lists the date, reading time, topic and tags', async () => {
		const { container } = await render(PostPage, { data: data() });
		expect(facts(container)).toEqual({
			Date: '09.04.2020',
			Read: '7 min',
			Topic: 'GitHub Actions',
			Tags: '#javascript #node '
		});
		expect(container.querySelector('.meta time')?.getAttribute('datetime')).toBe('2020-04-09');
	});

	it('links the series, and leaves out what a post lacks', async () => {
		const { container } = await render(PostPage, {
			data: data({
				topic: undefined,
				tags: [],
				series: { label: 'ESM in Node.js 2/3', url: '/series/esm-in-node-js/' }
			})
		});
		expect(facts(container)).toEqual({
			Date: '09.04.2020',
			Read: '7 min',
			Series: 'ESM in Node.js 2/3'
		});
		await expect
			.element(page.getByRole('link', { name: 'ESM in Node.js 2/3' }))
			.toHaveAttribute('href', '/series/esm-in-node-js/');
	});

	it('renders the post body, then ends with the subscribe box', async () => {
		const { container } = await render(PostPage, { data: data() });
		await expect.element(page.getByRole('heading', { level: 2, name: 'Why' })).toBeVisible();
		expect(container.querySelector('.prose em')?.textContent).toBe('CI');
		expect(container.querySelector('.prose a.direct-link')?.getAttribute('href')).toBe('#why');

		const subscribe = container.querySelector('article.post > aside.subscribe');
		expect(subscribe?.querySelector('standard-site-subscribe')?.getAttribute('publication')).toBe(
			PUB
		);
		expect(subscribe?.previousElementSibling?.classList.contains('prose')).toBe(true);
		expect(subscribe?.nextElementSibling).toBeNull();
	});

	it('puts the upvote before the subscribe box, and the comments after it', async () => {
		const { container } = await render(PostPage, {
			data: data({ discussion: { subject: DOC, script: 'data:text/javascript,', hide: '' } })
		});
		const subscribe = container.querySelector('article.post > aside.subscribe')!;
		const upvote = subscribe.previousElementSibling!;
		expect(upvote.querySelector('standard-site-upvote')?.getAttribute('subject')).toBe(DOC);
		expect(upvote.previousElementSibling?.classList.contains('prose')).toBe(true);
		const comments = subscribe.nextElementSibling!;
		await expect.element(page.getByRole('region', { name: 'Comments' })).toBe(comments);
		expect(comments.querySelector('standard-site-comments')?.getAttribute('subject')).toBe(DOC);
	});

	it('has a decorative reading progress bar driven by the scroll position', async () => {
		const { container } = await render(PostPage, { data: data() });
		const bar = container.querySelector<HTMLElement>('.progress')!;
		expect(bar.getAttribute('aria-hidden')).toBe('true');
		const style = getComputedStyle(bar);
		expect(style.position).toBe('fixed');
		expect(style.getPropertyValue('animation-timeline')).toBe('scroll(root)');
	});

	it('is the container its sidenotes measure themselves against', async () => {
		const { container } = await render(PostPage, { data: data() });
		const article = getComputedStyle(container.querySelector('article.post')!);
		expect(article.containerName).toBe('post');
		expect(article.containerType).toBe('inline-size');
	});

	it("shares with the post's own cover image, and links its record", async () => {
		await render(PostPage, { data: data() });
		const meta = (selector: string) =>
			document.head.querySelector(`meta[${selector}]`)?.getAttribute('content');

		expect(document.title).toBe('Jest and the `--changedSince` flag');
		expect(meta('name="description"')).toBe(
			"Getting Jest's --changedSince flag working on GitHub Actions CI."
		);
		expect(meta('property="og:url"')).toBe('https://bnb.im/posts/jest/');
		expect(meta('property="og:image"')).toBe('https://bnb.im/img/social/jest.png');
		expect(meta('property="og:image:width"')).toBe('1200');
		expect(meta('property="og:image:height"')).toBe('630');
		expect(meta('name="twitter:card"')).toBe('summary_large_image');
		expect(meta('name="at:canonical"')).toBe(DOC);
		expect(
			document.head.querySelector('link[rel="site.standard.document"]')?.getAttribute('href')
		).toBe(DOC);
	});
});
