import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import '@bnb/ui/themes/bnb.css';
import type { Row } from './PostTable.svelte';
import PostTable from './PostTable.svelte';

const rows: Row[] = [
	{
		n: '14',
		title: 'Jest and the <code>--changedSince</code> flag',
		url: '/posts/jest/',
		topic: 'GitHub Actions',
		date: '2020-04-09',
		year: '2020'
	},
	{
		n: '02',
		title: 'Implicit ESM in Node.js with &quot;type&quot;: &quot;module&quot;',
		url: '/posts/implicit/',
		series: { label: 'ESM in Node.js 2/3', url: '/series/esm-in-node-js/' },
		topic: 'Node.js',
		date: '2021-06-16',
		year: '2021'
	}
];

// Regexes hoisted to module scope (e18e/prefer-static-regex).
const SPACES = /\s+/g;

const headers = (container: HTMLElement) =>
	Array.from(container.querySelectorAll('thead th'), (th) => th.textContent);

describe('PostTable (component)', () => {
	it('heads the index with number, title, topic and year columns', async () => {
		const { container } = await render(PostTable, { rows });
		expect(headers(container)).toEqual(['№', 'Title', 'Topic', 'Year']);
		await expect.element(page.getByRole('columnheader', { name: 'Title' })).toBeVisible();
	});

	it('hides the topic column on narrow screens', async () => {
		const { container } = await render(PostTable, { rows });
		const topic = container.querySelector<HTMLElement>('th.topic')!;
		const cell = container.querySelector<HTMLElement>('td.topic')!;

		await page.viewport(1024, 768);
		await expect.element(page.getByRole('columnheader', { name: 'Topic' })).toBeVisible();
		expect(getComputedStyle(cell).display).not.toBe('none');

		await page.viewport(414, 896);
		await expect.poll(() => getComputedStyle(topic).display).toBe('none');
		expect(getComputedStyle(cell).display).toBe('none');
	});

	it('leaves out the topic column and renames the number column when asked', async () => {
		const { container } = await render(PostTable, { rows, numberLabel: 'Part', topics: false });
		expect(headers(container)).toEqual(['Part', 'Title', 'Year']);
		expect(container.querySelectorAll('td.topic')).toHaveLength(0);
	});

	it('lists a row per post with its number, title link, topic and year', async () => {
		const { container } = await render(PostTable, { rows });
		const cells = Array.from(container.querySelectorAll('tbody tr'), (tr) =>
			Array.from(tr.querySelectorAll('td'), (td) => td.textContent?.trim())
		);
		expect(cells[0]).toEqual(['14', 'Jest and the --changedSince flag', 'GitHub Actions', '2020']);

		await expect
			.element(page.getByRole('link', { name: 'Jest and the --changedSince flag' }))
			.toHaveAttribute('href', '/posts/jest/');
		const time = container.querySelector('tbody tr time');
		expect(time?.getAttribute('datetime')).toBe('2020-04-09');
		expect(time?.textContent).toBe('2020');
	});

	it('renders titles as HTML, so inline code and entities show', async () => {
		const { container } = await render(PostTable, { rows });
		const [jest, implicit] = container.querySelectorAll<HTMLAnchorElement>('a.title');
		expect(jest.querySelector('code')?.textContent).toBe('--changedSince');
		expect(implicit.textContent).toBe('Implicit ESM in Node.js with "type": "module"');
	});

	it('links a series post to its series', async () => {
		const { container } = await render(PostTable, { rows });
		await expect
			.element(page.getByRole('link', { name: 'ESM in Node.js 2/3' }))
			.toHaveAttribute('href', '/series/esm-in-node-js/');
		expect(container.querySelectorAll('.series-tag')).toHaveLength(1);
	});

	it('splits the rows by year when asked, each year heading its row group', async () => {
		const byYear: Row[] = [
			{ ...rows[1], n: '03', url: '/posts/c/', date: '2021-06-17' },
			{ ...rows[1], n: '02', url: '/posts/b/', date: '2021-06-16' },
			rows[0]
		];
		const { container } = await render(PostTable, { rows: byYear, byYear: true });

		const groups = Array.from(container.querySelectorAll('tbody'), (tbody) => ({
			heading: tbody
				.querySelector('th[scope="rowgroup"]')
				?.textContent?.replace(SPACES, ' ')
				.trim(),
			posts: Array.from(tbody.querySelectorAll('td.n'), (td) => td.textContent)
		}));
		expect(groups).toEqual([
			{ heading: '2021 2 posts', posts: ['03', '02'] },
			{ heading: '2020 1 post', posts: ['14'] }
		]);
		await expect.element(page.getByText('2021', { exact: true })).toBeVisible();
		expect(container.querySelector('th[scope="rowgroup"]')?.getAttribute('colspan')).toBe('4');

		// the newest year is filled pink; the rest are outlines on white
		document.documentElement.dataset.theme = 'bnb';
		const [newest, older] = container.querySelectorAll<HTMLElement>('.numeral');
		expect(getComputedStyle(newest).color).toBe('rgb(255, 0, 153)');
		expect(getComputedStyle(older).color).toBe('rgb(255, 255, 255)');
		delete document.documentElement.dataset.theme;

		// the year's in the heading, so each row shows its day and month
		expect(headers(container).at(-1)).toBe('Date');
		const time = container.querySelector('tbody time');
		expect(time?.textContent).toBe('17.06');
		expect(time?.getAttribute('datetime')).toBe('2021-06-17');
	});

	it('spans the year heading across however many columns there are', async () => {
		const { container } = await render(PostTable, { rows, byYear: true, topics: false });
		expect(container.querySelector('th[scope="rowgroup"]')?.getAttribute('colspan')).toBe('3');
	});

	it('renders an empty table without rows', async () => {
		const { container } = await render(PostTable, { rows: [] });
		expect(container.querySelectorAll('tbody tr')).toHaveLength(0);
		expect(headers(container)).toHaveLength(4);
	});
});
