// The subscribe button's browser bundle, from @bnb/standard-site's dist/client
// (`npm run build -w @bnb/standard-site`, which this app's dev and build
// scripts run first).
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

/** Where the bundle is; the package exports its files as `./client/*`. */
export function clientDir(): string {
	return path.dirname(require.resolve('@bnb/standard-site/client/subscribe.js'));
}

/** Every file in the bundle, relative to it: "subscribe.js", "chunks/oauth-….js". */
export function clientFiles(dir = clientDir()): string[] {
	return fs
		.readdirSync(dir, { recursive: true, withFileTypes: true })
		.filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
		.map((entry) =>
			path.relative(dir, path.join(entry.parentPath, entry.name)).split(path.sep).join('/')
		)
		.toSorted();
}

/** One file's contents, or null if it isn't part of the bundle. */
export function clientFile(file: string, dir = clientDir()): string | null {
	return clientFiles(dir).includes(file) ? fs.readFileSync(path.join(dir, file), 'utf8') : null;
}
