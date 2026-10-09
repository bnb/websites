import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { clientDir, clientFile, clientFiles } from './subscribe-client';

const CLIENT_DIR = /standard-site[\\/]dist[\\/]client$/;

function bundle() {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'subscribe-'));
	fs.mkdirSync(path.join(dir, 'chunks'));
	fs.writeFileSync(path.join(dir, 'subscribe.js'), 'export {};');
	fs.writeFileSync(path.join(dir, 'chunks', 'oauth-ABC.js'), 'export const oauth = 1;');
	fs.writeFileSync(path.join(dir, 'chunks', 'notes.txt'), 'not part of it');
	return dir;
}

describe('the subscribe button bundle', () => {
	it('is found through @bnb/standard-site', () => {
		expect(clientDir()).toMatch(CLIENT_DIR);
	});

	it('lists its scripts, in nested folders too, with forward slashes', () => {
		expect(clientFiles(bundle())).toEqual(['chunks/oauth-ABC.js', 'subscribe.js']);
	});

	it('serves only files that are part of it', () => {
		const dir = bundle();
		expect(clientFile('chunks/oauth-ABC.js', dir)).toBe('export const oauth = 1;');
		expect(clientFile('chunks/notes.txt', dir)).toBeNull();
		expect(clientFile('../package.json', dir)).toBeNull();
	});
});
