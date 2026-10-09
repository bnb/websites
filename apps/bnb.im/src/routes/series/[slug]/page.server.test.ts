import { isHttpError } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { entries, load } from './+page.server';

type LoadEvent = Parameters<typeof load>[0];

function run(slug: string) {
	const data = load({ params: { slug } } as LoadEvent);
	if (!data || data instanceof Promise) throw new Error('load() should return data synchronously');
	return data;
}

describe('series page', () => {
	it('prerenders a page for each series of more than one post', async () => {
		expect(await entries()).toEqual([{ slug: 'esm-in-node-js' }]);
	});

	it('lists the parts in order', () => {
		const data = run('esm-in-node-js');
		expect(data.title).toBe('ESM in Node.js');
		expect(data.description).toBe(
			'Stepping through various bits of developer experience around ESM in Node.js.'
		);
		expect(data.rows).toEqual([
			{
				n: '01',
				title: 'Explicit ESM in Node.js with .mjs',
				url: '/posts/explicit-esm-in-node-js-with-mjs/',
				date: '2021-06-16',
				year: '2021'
			},
			{
				n: '02',
				title: 'Implicit ESM in Node.js with &quot;type&quot;: &quot;module&quot;',
				url: '/posts/implicit-esm-in-node-js-with-type-module/',
				date: '2021-06-16',
				year: '2021'
			},
			{
				n: '03',
				title: 'Conditional Exports: Supporting both import and require()',
				url: '/posts/conditional-exports-supporting-both-import-and-require/',
				date: '2021-06-17',
				year: '2021'
			}
		]);
	});

	it('is a 404 for a series that does not exist', () => {
		let thrown: unknown;
		try {
			run('no-such-series');
		} catch (error) {
			thrown = error;
		}
		expect(isHttpError(thrown, 404)).toBe(true);
		expect(thrown).toMatchObject({ body: { message: 'Not found' } });
	});
});
