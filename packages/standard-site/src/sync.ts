// Syncs a site's posts to its PDS as site.standard.document records: builds
// each record, diffs it against what's already there, and writes only what
// changed. The PDS itself is the state, so there's no local state file.
import fs from 'node:fs';
import path from 'node:path';
import { siteUrlFor } from '@bnb/atmosphere';
import { parseAtUri } from './aturi';
import { blobCid, canonicalJson, imageInfo } from './bytes';
import { checkDocuments } from './checks';
import { DOCUMENT, PUBLICATION } from './constants';
import { toContent, type Block, type PendingBlock } from './leaflet';
import { Pds, TIMEOUT, type AtpRecord, type BlobRef } from './pds';
import { pinAtUri, pinProblem } from './pin';
import type { Publication } from './site';

const MAX_BLOB_SIZE = 1_000_000;

// how many images, uploads, and lookups run at once
const CONCURRENCY = 8;

// fields publishing owns on a document record. anything else on an existing
// record (added by another tool, say) is left alone.
const MANAGED = [
	'$type',
	'site',
	'path',
	'title',
	'description',
	'publishedAt',
	'updatedAt',
	'tags',
	'textContent',
	'content',
	'coverImage',
	'canonicalUrl'
];

const SCHEME = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
const FETCHABLE = /^(?:https?|data):/;
const QUERY_OR_HASH = /[?#].*$/;
const BSKY_POST = /^https:\/\/bsky\.app\/profile\/([^/]+)\/post\/([a-z0-9]+)/;
const TRAILING_SLASH = /\/$/;

const log = (message: string) => console.log(`[standard-site] ${message}`);
const warn = (message: string) => console.warn(`[standard-site] ${message}`);

/** A post, ready to sync. */
export interface Document {
	/** the post's source file, which a new atUri is pinned into */
	inputPath: string;
	/** the page's path on the site */
	url: string;
	fileSlug: string;
	uri: string;
	pinned: boolean;
	title: string;
	description?: string;
	date: Date;
	updatedAt?: Date;
	tags: string[];
	/** whether the date comes from the post itself */
	fixedDate: boolean;
	/** from tokensToBlocks; a post without blocks has no content to compare and is left alone */
	blocks?: Block[];
	textContent?: string;
}

/** One write, as reported (and, outside a dry run, made). */
export interface Write {
	label: string;
	fields: string[];
	record?: Record<string, unknown>;
}

export interface SyncOptions {
	documents: Document[];
	publication: Publication;
	siteUrl: string;
	/** where `/`-rooted local image paths are looked for */
	inputDir: string;
	/** the built site, where generated images are looked for */
	outputDir?: string;
	/** a path to an image file for a post's coverImage, or nothing */
	coverImage?: (doc: Document) => string | undefined;
	credentials: { identifier?: string; password?: string };
	/** report what would change without writing (no password needed) */
	dryRun?: boolean;
	/** delete records under the publication that no post maps to */
	prune?: boolean;
	/** called for every write, made or (in a dry run) not */
	onWrite?: (write: Write) => void;
}

/** Runs the functions it's handed at most `size` at a time. */
export function limiter(size: number) {
	let active = 0;
	const queue: Array<{
		fn: () => unknown;
		resolve: (v: unknown) => void;
		reject: (e: unknown) => void;
	}> = [];
	const next = () => {
		if (active >= size || !queue.length) return;
		active++;
		const { fn, resolve, reject } = queue.shift()!;
		Promise.resolve()
			.then(fn)
			.then(resolve, reject)
			.finally(() => {
				active--;
				next();
			});
	};
	return <T>(fn: () => T | Promise<T>): Promise<T> =>
		new Promise<T>((resolve, reject) => {
			queue.push({ fn, resolve: resolve as (v: unknown) => void, reject });
			next();
		});
}

// every blob ref ($link) anywhere in a record, so blobs the PDS already holds
// for an existing record aren't uploaded again
function collectBlobs(value: unknown, found = new Map<string, BlobRef>()): Map<string, BlobRef> {
	if (value && typeof value === 'object') {
		const blob = value as BlobRef;
		if (blob.$type === 'blob' && blob.ref?.$link) {
			found.set(blob.ref.$link, blob);
		} else {
			for (const item of Object.values(value)) collectBlobs(item, found);
		}
	}
	return found;
}

/**
 * Where a local image might be, given its src as written in the post. The src
 * is a URL, so it's decoded and loses any query or fragment. An image made
 * during the build is in the output directory rather than the input.
 */
export function localPaths(
	src: string,
	{ inputPath, url }: Pick<Document, 'inputPath' | 'url'>,
	{ inputDir, outputDir }: { inputDir: string; outputDir?: string }
): string[] {
	let file = src.replace(QUERY_OR_HASH, '');
	try {
		file = decodeURIComponent(file);
	} catch {
		// not percent-encoded after all
	}
	const paths = file.startsWith('/')
		? [path.join(inputDir, file), outputDir && path.join(outputDir, file)]
		: [path.join(path.dirname(inputPath), file), outputDir && path.join(outputDir, url, file)];
	return paths.filter((p): p is string => !!p);
}

class Assets {
	blobs = new Map<string, Promise<BlobRef>>();
	posts = new Map<string, Promise<{ uri: string; cid: string }>>();
	limit = limiter(CONCURRENCY);

	constructor(
		readonly options: {
			pds: Pds;
			existingBlobs: Map<string, BlobRef>;
			inputDir: string;
			outputDir?: string;
			dryRun: boolean;
		}
	) {}

	// an image's bytes, from the web (`url` is the src resolved against the
	// page) or from the site's files
	async read({ src, url }: PendingBlock, doc: Document): Promise<Buffer> {
		if (SCHEME.test(src!)) {
			if (!FETCHABLE.test(url)) throw new Error(`can't fetch ${url}`);
			return this.limit(async () => {
				const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
				if (!response.ok) throw new Error(`${response.status} fetching ${url}`);
				if (Number(response.headers.get('content-length')) > MAX_BLOB_SIZE) {
					await response.body?.cancel();
					throw new Error(`${url} is over the ${MAX_BLOB_SIZE} byte blob limit`);
				}
				return Buffer.from(await response.arrayBuffer());
			});
		}
		let firstError: unknown;
		for (const file of localPaths(src!, doc, this.options)) {
			try {
				return await this.limit(() => fs.promises.readFile(file));
			} catch (error) {
				firstError ??= error;
			}
		}
		throw firstError;
	}

	// an image file as a blob ref plus its dimensions, uploading it only when
	// no existing record already references the same bytes
	async blob(bytes: Buffer, label: string) {
		const info = imageInfo(bytes);
		if (!info) throw new Error(`${label} isn't a PNG, JPEG, GIF, or WebP image`);
		if (bytes.length > MAX_BLOB_SIZE) {
			throw new Error(
				`${label} is ${bytes.length} bytes, over the ${MAX_BLOB_SIZE} byte blob limit`
			);
		}
		const cid = blobCid(bytes);
		if (!this.blobs.has(cid)) {
			this.blobs.set(
				cid,
				(async (): Promise<BlobRef> => {
					const existing = this.options.existingBlobs.get(cid);
					if (existing) return existing;
					if (this.options.dryRun) {
						return {
							$type: 'blob',
							ref: { $link: cid },
							mimeType: info.mimeType,
							size: bytes.length
						};
					}
					const blob = await this.limit(() => this.options.pds.uploadBlob(bytes, info.mimeType));
					log(`Uploaded ${label}`);
					return blob;
				})()
			);
		}
		return {
			blob: await this.blobs.get(cid)!,
			aspectRatio: { width: info.width, height: info.height }
		};
	}

	// a bsky.app post URL as a strong ref (uri + cid), which the post block needs
	bskyPost(url: string) {
		if (!this.posts.has(url)) {
			this.posts.set(
				url,
				this.limit(async () => {
					const [, actor, rkey] = BSKY_POST.exec(url)!;
					const appview = new Pds('https://public.api.bsky.app');
					// getPosts only takes DIDs in its URIs, not handles
					const did = actor.startsWith('did:')
						? actor
						: (
								await appview.request<{ did: string }>(
									'GET',
									'com.atproto.identity.resolveHandle',
									{
										params: { handle: actor }
									}
								)
							).did;
					const {
						posts: [post]
					} = await appview.request<{ posts: Array<{ uri: string; cid: string }> }>(
						'GET',
						'app.bsky.feed.getPosts',
						{ params: { uris: `at://${did}/app.bsky.feed.post/${rkey}` } }
					);
					if (!post) throw new Error(`${url} wasn't found`);
					return { uri: post.uri, cid: post.cid };
				})
			);
		}
		return this.posts.get(url)!;
	}

	// swap pending placeholders for real blocks, or their text fallback when
	// the image or post can't be resolved
	resolve(blocks: Block[], doc: Document): Promise<Array<Block | Record<string, unknown>>> {
		return Promise.all(
			blocks.map(async (block) => {
				if (!('pending' in block)) return block;
				try {
					if (block.pending === 'image') {
						const { blob, aspectRatio } = await this.blob(await this.read(block, doc), block.src!);
						return {
							$type: 'pub.leaflet.blocks.image',
							image: blob,
							aspectRatio,
							...(block.alt && { alt: block.alt })
						};
					}
					return { $type: 'pub.leaflet.blocks.bskyPost', postRef: await this.bskyPost(block.url) };
				} catch (error) {
					warn(
						`${doc.url}: using a link for ${block.src || block.url}: ${(error as Error).message}`
					);
				}
				return block.fallback;
			})
		);
	}
}

async function buildRecord(
	doc: Document,
	{
		publicationUri,
		siteUrl,
		assets,
		coverImage
	}: {
		publicationUri: string;
		siteUrl: string;
		assets: Assets;
		coverImage?: SyncOptions['coverImage'];
	}
): Promise<Record<string, unknown>> {
	const record: Record<string, unknown> = {
		$type: DOCUMENT,
		site: publicationUri,
		path: doc.url,
		title: doc.title,
		description: doc.description,
		publishedAt: doc.date.toISOString(),
		updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : undefined,
		tags: doc.tags.length ? doc.tags : undefined,
		textContent: doc.textContent,
		content: toContent(await assets.resolve(doc.blocks!, doc)),
		canonicalUrl: siteUrlFor(siteUrl, doc.url)
	};

	const coverPath = coverImage?.(doc);
	if (coverPath) {
		try {
			record.coverImage = (
				await assets.blob(await fs.promises.readFile(coverPath), path.basename(coverPath))
			).blob;
		} catch (error) {
			warn(`${doc.url}: skipping cover image: ${(error as Error).message}`);
		}
	}
	return record;
}

// managed fields come from the post; everything else on the existing record
// is kept as-is
function merge(existing: Record<string, unknown>, record: Record<string, unknown>) {
	const merged = { ...existing };
	for (const key of MANAGED) {
		if (record[key] === undefined) delete merged[key];
		else merged[key] = record[key];
	}
	return merged;
}

// which top-level fields differ, for the dry-run report
const changedFields = (before: Record<string, unknown>, after: Record<string, unknown>) =>
	[...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
		(key) => canonicalJson(before[key]) !== canonicalJson(after[key])
	);

// problems with unpinned posts that only the records already published can
// show. an unpinned post finds its record by the URI derived from its date
// and slug, so a record for its path at another URI means that derivation
// changed since it was published, and a record at its URI for another post's
// path means two posts collided.
function checkUris(documents: Document[], existingDocs: AtpRecord[], publicationUri: string) {
	const ours = existingDocs.filter((record) => record.value.site === publicationUri);
	const byPath = new Map(ours.map((record) => [record.value.path, record]));
	const byRkey = new Map(ours.map((record) => [parseAtUri(record.uri).rkey, record]));
	const claimed = new Set(documents.map((doc) => parseAtUri(doc.uri).rkey));
	const urls = new Set(documents.map((doc) => doc.url));
	const errors: string[] = [];
	for (const doc of documents.filter((d) => !d.pinned)) {
		const { rkey } = parseAtUri(doc.uri);
		const previous = byPath.get(doc.url);
		if (previous && !claimed.has(parseAtUri(previous.uri).rkey)) {
			errors.push(
				`${doc.inputPath} was published as ${previous.uri}, but this build gave it ${doc.uri}. Add \`atUri: "${previous.uri}"\` to its front matter to keep the record it has.`
			);
		}
		const holder = byRkey.get(rkey)?.value.path as string | undefined;
		if (holder && holder !== doc.url && urls.has(holder)) {
			errors.push(
				`${doc.inputPath} was given ${doc.uri}, which holds the record for ${holder}. Give one of them a different \`date\`, or pin each with \`atUri\`.`
			);
		}
	}
	return errors;
}

const fail = (errors: string[]): never => {
	throw new Error(`Can't publish:\n${errors.map((error) => `  - ${error}`).join('\n')}`);
};

/** Sync the posts to the publication's PDS. A dry run reports instead of writing. */
export async function sync({
	documents,
	publication,
	siteUrl,
	inputDir,
	outputDir,
	coverImage,
	credentials,
	dryRun = false,
	prune = false,
	onWrite
}: SyncOptions): Promise<{ created: number; updated: number; unchanged: number; orphans: number }> {
	const { did, rkey: publicationRkey } = parseAtUri(publication.uri);

	const { errors, warnings } = checkDocuments(documents);
	for (const warning of warnings) warn(warning);
	if (errors.length) fail(errors);

	if (!dryRun && !credentials.password) {
		throw new Error(
			"Set ATPROTO_APP_PASSWORD (an app password from your account settings) to publish. A dry run doesn't need one."
		);
	}
	const pds = await Pds.forDid(did);
	if (!dryRun) {
		const session = await pds.login(credentials.identifier || did, credentials.password!);
		if (session.did !== did) {
			throw new Error(`Logged in as ${session.did}, but the publication belongs to ${did}`);
		}
	}

	const [existingDocs, existingPublication] = await Promise.all([
		pds.listRecords(did, DOCUMENT),
		pds.getRecord(did, PUBLICATION, publicationRkey)
	]);
	const byRkey = new Map(existingDocs.map((record) => [parseAtUri(record.uri).rkey, record]));

	// everything that can stop the publish is checked before anything's
	// uploaded or written
	const uriErrors = checkUris(documents, existingDocs, publication.uri);
	for (const doc of documents) {
		const existing = byRkey.get(parseAtUri(doc.uri).rkey);
		if (existing && existing.value.site !== publication.uri) {
			uriErrors.push(
				`${doc.uri} already holds a record for ${existing.value.site}, refusing to overwrite it`
			);
		}
	}
	if (uriErrors.length) fail(uriErrors);

	// the publication record: only the fields set in the options
	const publicationRecord: Record<string, unknown> = {
		...existingPublication?.value,
		$type: PUBLICATION,
		url: siteUrl.replace(TRAILING_SLASH, ''),
		...(publication.name && { name: publication.name }),
		...(publication.description && { description: publication.description })
	};
	if (publication.showInDiscover !== undefined) {
		publicationRecord.preferences = {
			...(publicationRecord.preferences as object | undefined),
			showInDiscover: publication.showInDiscover
		};
	}
	if (!publicationRecord.name) throw new Error('The publication needs a name.');

	const writes: Array<Write & { run: () => Promise<unknown> }> = [];
	if (
		!existingPublication ||
		canonicalJson(existingPublication.value) !== canonicalJson(publicationRecord)
	) {
		writes.push({
			label: `publication ${existingPublication ? 'updated' : 'created'}`,
			fields: changedFields(existingPublication?.value || {}, publicationRecord),
			record: publicationRecord,
			run: () => pds.putRecord(did, PUBLICATION, publicationRkey, publicationRecord)
		});
	}

	// a post without blocks has no content to compare, so its record is left as it is
	const rendered = documents.filter((doc) => doc.blocks);
	for (const doc of documents.filter((d) => !d.blocks)) {
		warn(
			`${doc.url} has no content, so ${byRkey.has(parseAtUri(doc.uri).rkey) ? 'its record is left as it is' : "it isn't published yet"}`
		);
	}

	const assets = new Assets({
		pds,
		existingBlobs: collectBlobs(existingDocs.map((record) => record.value)),
		inputDir,
		outputDir,
		dryRun
	});
	const records = await Promise.all(
		rendered.map((doc) =>
			buildRecord(doc, { publicationUri: publication.uri, siteUrl, assets, coverImage })
		)
	);

	const counts = { created: 0, updated: 0, unchanged: 0 };
	rendered.forEach((doc, index) => {
		const { rkey } = parseAtUri(doc.uri);
		const existing = byRkey.get(rkey);
		const record = merge(existing ? existing.value : {}, records[index]);
		if (existing && canonicalJson(existing.value) === canonicalJson(record)) {
			counts.unchanged++;
			return;
		}
		counts[existing ? 'updated' : 'created']++;
		writes.push({
			label: `${doc.url} ${existing ? 'updated' : 'created'}`,
			fields: changedFields(existing ? existing.value : {}, record),
			record,
			run: () => pds.putRecord(did, DOCUMENT, rkey, record)
		});
	});

	// records under this publication that no post maps to anymore
	const known = new Set(documents.map((doc) => parseAtUri(doc.uri).rkey));
	const orphans = existingDocs.filter(
		(record) => record.value.site === publication.uri && !known.has(parseAtUri(record.uri).rkey)
	);
	for (const orphan of orphans) {
		if (prune) {
			writes.push({
				label: `${orphan.value.path || orphan.uri} deleted`,
				fields: [],
				run: () => pds.deleteRecord(did, DOCUMENT, parseAtUri(orphan.uri).rkey)
			});
		} else {
			warn(
				`${orphan.uri} (${orphan.value.path || 'no path'}) doesn't match any post. Prune to delete it.`
			);
		}
	}

	for (const { run, ...write } of writes) {
		onWrite?.(write);
		if (dryRun) {
			log(`would be ${write.label}${write.fields.length ? `: ${write.fields.join(', ')}` : ''}`);
		} else {
			await run();
		}
	}

	// the records are written by now, so a post that can't be pinned is only
	// warned about (it was already, before publishing)
	if (!dryRun) {
		for (const doc of rendered.filter((d) => !d.pinned && !pinProblem(d))) {
			try {
				pinAtUri(doc);
			} catch (error) {
				warn(`Couldn't pin ${doc.uri} into ${doc.inputPath}: ${(error as Error).message}`);
			}
		}
	}

	const skipped = documents.length - rendered.length;
	const summary =
		`${counts.created} created, ${counts.updated} updated, ${counts.unchanged} unchanged` +
		(skipped ? `, ${skipped} skipped` : '') +
		(orphans.length ? `, ${orphans.length} orphaned${prune ? ' (deleted)' : ''}` : '');
	log(dryRun ? `Dry run: ${summary}` : `Published: ${summary}`);
	return { ...counts, orphans: orphans.length };
}
