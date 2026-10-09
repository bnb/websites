// Publishing: every post becomes a site.standard.document record on the PDS,
// with its content as leaflet rich text built from the same markdown-it tokens
// the page is rendered from. @bnb/standard-site converts the tokens, diffs the
// records against the PDS, uploads cover images and pins new atUris into front
// matter; scripts/publish.js runs this after a build.
import fs from 'node:fs';
import path from 'node:path';
import { tokensToBlocks } from '@bnb/standard-site';
import { sync, type Document, type SyncOptions } from '@bnb/standard-site/sync';
import { SITE_URL } from '../site';
import { footnotesAsList } from './footnotes';
import { frontMatter } from './front-matter';
import { md } from './markdown';
import type { Post } from './posts';
import { loadPosts } from './posts';
import { PUBLICATION, documentUris } from './standard-site';

/** What publishing runs on; tests hand in stand-ins. */
export interface StandardSite {
	tokensToBlocks: typeof tokensToBlocks;
	sync: (options: SyncOptions) => Promise<unknown>;
}

const DEFAULT: StandardSite = { tokensToBlocks, sync };

export type PublishDocument = Document;

/** The records to sync: every post but drafts, with the post tag left out of its tags. */
export function toDocuments(
	posts: readonly Post[],
	{
		root,
		tokensToBlocks: convert = tokensToBlocks
	}: { root: string; tokensToBlocks?: StandardSite['tokensToBlocks'] }
): PublishDocument[] {
	const uris = documentUris(posts);
	return posts
		.filter((post) => !post.draft)
		.map((post) => {
			const { uri, pinned } = uris.get(post.slug)!;
			const { blocks, textContent } = convert(footnotesAsList(md.parse(post.source, {})), {
				source: post.source,
				baseUrl: new URL(post.url, `${SITE_URL}/`).href,
				blueskyPosts: true,
				breaks: true
			});
			return {
				inputPath: path.join(root, post.file),
				url: post.url,
				fileSlug: post.slug,
				uri,
				pinned,
				title: post.title,
				description: post.description,
				date: post.date,
				updatedAt: post.updatedAt,
				tags: post.tags.filter((tag) => tag !== 'post'),
				// every post's date comes from its front matter
				fixedDate: true,
				blocks,
				textContent
			};
		});
}

export interface PublishOptions {
	/** the app's root (where posts/ is) */
	root: string;
	/** the built site, which holds the social images used as cover images */
	outputDir: string;
	dryRun: boolean;
	prune: boolean;
	credentials: { identifier?: string; password?: string };
	standardSite?: StandardSite;
}

/** Sync every post to the PDS. A dry run reports what would change without writing. */
export async function publish({
	root,
	outputDir,
	dryRun,
	prune,
	credentials,
	standardSite = DEFAULT
}: PublishOptions): Promise<PublishDocument[]> {
	const documents = toDocuments(loadPosts(), {
		root,
		tokensToBlocks: standardSite.tokensToBlocks
	});
	await standardSite.sync({
		documents,
		publication: PUBLICATION,
		siteUrl: SITE_URL,
		inputDir: root,
		outputDir,
		coverImage: (doc) => path.join(outputDir, 'img', 'social', `${doc.fileSlug}.png`),
		credentials,
		dryRun,
		prune
	});
	return documents;
}

/**
 * Posts whose built page doesn't link the record they're pinned to (or that
 * aren't pinned at all), read fresh from disk after publishing pinned them.
 */
export function unlinkedPosts({ root, outputDir }: { root: string; outputDir: string }): string[] {
	const postsDir = path.join(root, 'posts');
	return fs
		.readdirSync(postsDir)
		.filter((file) => file.endsWith('.md'))
		.flatMap((file) => {
			const slug = file.slice(0, -3);
			const { data } = frontMatter(fs.readFileSync(path.join(postsDir, file), 'utf8'));
			if (data.draft === true) return [];
			const html = fs.readFileSync(path.join(outputDir, 'posts', slug, 'index.html'), 'utf8');
			return data.atUri && html.includes(`rel="site.standard.document" href="${data.atUri}"`)
				? []
				: [slug];
		});
}
