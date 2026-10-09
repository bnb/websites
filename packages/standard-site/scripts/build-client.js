// Bundles the site's scripts into dist/client, which sites serve at
// /standard-site/: small entries that define the elements (the subscribe
// button; the upvote button and comments), the OAuth client in a chunk of its
// own, loaded only when a reader writes, and the comments' Markdown renderer,
// loaded only when there are comments to show.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import esbuild from 'esbuild';

const root = path.join(import.meta.dirname, '..');
const outdir = path.join(root, 'dist', 'client');

// Each @atproto package nests its own copy of zod 3 (the monorepo's root zod
// is knip's zod 4), and each copy would be bundled. Resolve every zod import
// from one of them instead.
const require = createRequire(import.meta.url);
const oauthClient = path.dirname(require.resolve('@atproto/oauth-client'));
const ZOD = /^zod(?:\/|$)/;
/** @type {import('esbuild').Plugin} */
const oneZod = {
	name: 'one-zod',
	setup(build) {
		build.onResolve({ filter: ZOD }, (args) =>
			args.pluginData?.oneZod
				? undefined
				: build.resolve(args.path, {
						kind: args.kind,
						resolveDir: oauthClient,
						pluginData: { oneZod: true }
					})
		);
	}
};

fs.rmSync(outdir, { recursive: true, force: true });

await esbuild.build({
	entryPoints: ['subscribe.ts', 'discussion.ts'].map((entry) =>
		path.join(root, 'src', 'client', entry)
	),
	outdir,
	bundle: true,
	splitting: true,
	format: 'esm',
	minify: true,
	target: 'es2022',
	chunkNames: 'chunks/[name]-[hash]',
	logLevel: 'warning',
	plugins: [oneZod]
});
