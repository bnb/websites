// `npm run publish`: build the site, sync every post to the AT Protocol as a
// site.standard.document record (pinning new atUris into front matter), check
// the built HTML links each record, then commit the pinned posts and push, so
// the deploy workflow puts the site live.
//
//   --dry-run  show what would change on the PDS without writing anything
//   --prune    delete records under the publication that no post maps to
//
// ATPROTO_APP_PASSWORD (an app password) lives in the gitignored .env.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const root = path.join(import.meta.dirname, '..');
const outputDir = path.join(root, 'build');
const postsDir = path.join(root, 'posts');
const dryRun = process.argv.includes('--dry-run');
const prune = process.argv.includes('--prune');

const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, stdio: 'inherit' });
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

function fail(message) {
	console.error(`\n[publish] ${message}`);
	process.exit(1);
}

if (fs.existsSync(path.join(root, '.env'))) {
	process.loadEnvFile(path.join(root, '.env'));
}

// bail before touching the PDS if the push at the end is going to fail anyway
if (!dryRun) {
	const branch = git('branch', '--show-current');
	if (branch !== 'main') fail(`On "${branch}", but the site deploys from main.`);
	git('fetch', '--quiet');
	if (git('rev-list', '--count', 'HEAD..@{u}') !== '0') fail('main is behind origin. Pull first.');
}

run('npm', ['run', 'build']);

// the posts are loaded through Vite, the way the site loads them
const vite = await createServer({
	root,
	configFile: path.join(root, 'vite.config.ts'),
	logLevel: 'warn',
	server: { middlewareMode: true, hmr: false, ws: false },
	appType: 'custom'
});
let unlinked;
try {
	const { publish, unlinkedPosts } = await vite.ssrLoadModule('/src/lib/server/publish.ts');
	await publish({
		root,
		outputDir,
		dryRun,
		prune,
		credentials: {
			identifier: process.env.ATPROTO_IDENTIFIER,
			password: process.env.ATPROTO_APP_PASSWORD
		}
	});
	unlinked = dryRun ? [] : unlinkedPosts({ root, outputDir });
} finally {
	await vite.close();
}
if (dryRun) process.exit(0);

// publishing pinned an atUri into every post that lacked one, and the HTML
// built alongside it should already link to that same record
if (unlinked.length) {
	fail(`Built HTML is missing its site.standard.document tag: ${unlinked.join(', ')}`);
}

git('add', postsDir);
if (spawnSync('git', ['diff', '--cached', '--quiet', '--', postsDir], { cwd: root }).status !== 0) {
	run('git', ['status', '--short', '--', postsDir]);
	run('git', ['commit', '--quiet', '-m', 'chore(bnb.im): publish', '--', postsDir]);
}

if (git('rev-list', '--count', '@{u}..HEAD') !== '0') {
	run('git', ['push']);
} else {
	console.log('\n[publish] Nothing to push. Everything is already live.');
}
