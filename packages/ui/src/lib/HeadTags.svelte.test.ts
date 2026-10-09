import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import HeadTags, { type HeadTag } from './HeadTags.svelte';

const DOC = 'at://did:plc:uashgn65n5z7aqwk5cbuba5c/site.standard.document/3mwwg6sy4e32e';
const PUB = 'at://did:plc:uashgn65n5z7aqwk5cbuba5c/site.standard.publication/3mtxb2uyta22l';

const meta = (name: string) =>
	document.head.querySelector(`meta[name="${name}"]`)?.getAttribute('content');
const link = (rel: string) =>
	document.head.querySelector(`link[rel="${rel}"]`)?.getAttribute('href');

describe('HeadTags (component)', () => {
	it('writes AT Tags as meta tags and record links as link tags in the head', async () => {
		const tags: HeadTag[] = [
			{ name: 'at:me', content: 'at://did:plc:uashgn65n5z7aqwk5cbuba5c' },
			{ name: 'at:canonical', content: DOC },
			{ rel: 'site.standard.document', href: DOC },
			{ rel: 'site.standard.publication', href: PUB }
		];
		const { container, unmount } = await render(HeadTags, { tags });

		expect(meta('at:me')).toBe('at://did:plc:uashgn65n5z7aqwk5cbuba5c');
		expect(meta('at:canonical')).toBe(DOC);
		expect(link('site.standard.document')).toBe(DOC);
		expect(link('site.standard.publication')).toBe(PUB);
		// nothing lands in the body
		expect(container.innerHTML.replaceAll(/<!--.*?-->/g, '')).toBe('');

		unmount();
		expect(meta('at:me')).toBeUndefined();
		expect(link('site.standard.document')).toBeUndefined();
	});

	it('writes nothing for no tags', async () => {
		await render(HeadTags, { tags: [] });
		expect(document.head.querySelector('meta[name^="at:"]')).toBeNull();
	});
});
