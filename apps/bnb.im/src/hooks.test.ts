import { describe, expect, it } from 'vitest';
import { reroute } from './hooks';

const route = (href: string) => reroute({ url: new URL(href) } as Parameters<typeof reroute>[0]);

describe('reroute', () => {
	it('serves /oauth/callback/ from its prerendered index.html, as static hosts do', () => {
		expect(route('https://bnb.im/oauth/callback/')).toBe('/oauth/callback/index.html');
		expect(route('http://127.0.0.1:5174/oauth/callback/?code=abc&state=xyz')).toBe(
			'/oauth/callback/index.html'
		);
	});

	it('leaves every other path alone', () => {
		expect(route('https://bnb.im/')).toBeUndefined();
		expect(route('https://bnb.im/oauth/callback')).toBeUndefined();
		expect(route('https://bnb.im/oauth/callback/index.html')).toBeUndefined();
		expect(route('https://bnb.im/posts/is-mdm/')).toBeUndefined();
	});
});
