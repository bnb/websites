import { describe, expect, it } from 'vitest';
import { MIXES } from './fixtures';
import { sessionMetadata } from './session';

describe('sessionMetadata', () => {
	it('names the mix, the DJ and the site, with the cover at two sizes', () => {
		expect(sessionMetadata(MIXES[0])).toEqual({
			title: "one shot: I promise it's techno",
			artist: 'tierney cyren',
			album: 'tierneycyren.com',
			artwork: [
				{
					src: 'https://images.plyr.fm/cdn-cgi/image/width=256,format=auto/images/3b7c2b2a9a66b36b.jpeg',
					sizes: '256x256'
				},
				{
					src: 'https://images.plyr.fm/cdn-cgi/image/width=512,format=auto/images/3b7c2b2a9a66b36b.jpeg',
					sizes: '512x512'
				}
			]
		});
	});

	it('falls back to the DJ’s name, and has no artwork without a cover', () => {
		const metadata = sessionMetadata({ ...MIXES[1], artist: '', image: '' });
		expect(metadata.artist).toBe('tierney cyren');
		expect(metadata.artwork).toEqual([]);
	});
});
