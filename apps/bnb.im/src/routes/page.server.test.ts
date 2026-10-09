import { describe, expect, it } from 'vitest';
import { load } from './+page.server';

type LoadEvent = Parameters<typeof load>[0];

describe('index page load', () => {
	it('lists every post, newest first and numbered highest', async () => {
		const data = await load({} as LoadEvent);
		if (!data) throw new Error('load() returned nothing');

		expect(data.rows).toHaveLength(14);
		expect(data.rows.map((row: { n: string }) => row.n)).toEqual(
			Array.from({ length: 14 }, (_, i) => String(14 - i).padStart(2, '0'))
		);
		expect(data.rows[0]).toMatchObject({
			title: 'What is the Atmosphere: An Untech Introduction',
			url: '/posts/what-is-the-atmosphere/',
			topic: 'AT Protocol',
			date: '2026-10-02',
			year: '2026'
		});
		expect(data.rows.at(-1)).toMatchObject({
			n: '01',
			title: 'My 🔥 First Experience Attending TC39',
			topic: 'TC39',
			year: '2019'
		});
	});
});
