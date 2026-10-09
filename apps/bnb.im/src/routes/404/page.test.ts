import { describe, expect, it } from 'vitest';
import { trailingSlash } from './+page';

describe('404 page options', () => {
	it('prerenders to /404.html, which GitHub Pages serves for unknown paths', () => {
		expect(trailingSlash).toBe('never');
	});
});
