import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { RequestEvent } from '@sveltejs/kit';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { requestLogging } from './logging';

// its own file, since requestLogging sets up evlog for the whole process
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evlog-'));
vi.stubEnv('EVLOG_FS_DIR', dir);
vi.spyOn(console, 'log').mockImplementation(() => {});

afterAll(() => {
	vi.unstubAllEnvs();
	fs.rmSync(dir, { recursive: true, force: true });
});

describe('requestLogging in development', () => {
	it('also writes each wide event to a file, for reading back while debugging', async () => {
		const { handle } = requestLogging({
			service: 'site',
			dev: true,
			handle: ({ event, resolve }) => resolve(event)
		});
		await handle({
			event: {
				request: new Request('http://localhost/'),
				url: new URL('http://localhost/'),
				locals: {}
			} as RequestEvent,
			resolve: async () => new Response('page')
		});

		const read = () =>
			fs
				.readdirSync(dir)
				.filter((file) => file.endsWith('.jsonl'))
				.map((file) => fs.readFileSync(path.join(dir, file), 'utf8'))
				.join('');
		await vi.waitFor(() => expect(read()).toContain('"path":"/"'));
		expect(JSON.parse(read().trim())).toMatchObject({
			service: 'site',
			environment: 'development',
			status: 200
		});
	});
});
