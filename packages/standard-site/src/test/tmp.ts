// A fresh temporary directory for each test that writes files.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach } from 'vitest';

/** The current test's temporary directory, made before it and removed after. */
export function useTmpDir() {
	const dir = { path: '' };
	beforeEach(() => {
		dir.path = fs.mkdtempSync(path.join(os.tmpdir(), 'standard-site-'));
	});
	afterEach(() => {
		fs.rmSync(dir.path, { recursive: true, force: true });
	});
	return dir;
}
