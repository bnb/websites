// Turns a bare bsky.app post link on its own line into a static embed at build
// time: no third-party script or iframe, styled by styles/bluesky.css.
import fs from 'node:fs';
import path from 'node:path';
import { readableDate } from '../dates';

const API = 'https://public.api.bsky.app/xrpc';
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000;

// a paragraph holding nothing but a bare bsky.app post url, which is what
// markdown-it's linkify turns a url on its own line into. links with custom
// text (`[like this](https://bsky.app/...)`) are left alone.
const STANDALONE_POST_LINK =
	/<p>\s*<a href="(https:\/\/bsky\.app\/profile\/([^"/]+)\/post\/([a-z0-9]+))\/?">\1\/?<\/a>\s*<\/p>/g;

// labels Bluesky's own embed respects: the author asked not to be shown to
// logged-out viewers, or the media shouldn't be shown without a click-through
const NO_UNAUTHENTICATED = '!no-unauthenticated';
const SENSITIVE_LABELS = new Set(['porn', 'sexual', 'nudity', 'graphic-media', 'gore']);

const BUTTERFLY =
	'<svg viewBox="0 0 600 530" width="24" height="21" aria-hidden="true"><path d="m135.72 44.03c66.496 49.921 138.02 151.14 164.28 205.46 26.262-54.316 97.782-155.54 164.28-205.46 47.98-36.021 125.72-63.892 125.72 24.795 0 17.712-10.155 148.79-16.111 170.07-20.703 73.984-96.144 92.854-163.25 81.433 117.3 19.964 147.14 86.092 82.697 152.22-122.39 125.59-175.91-31.511-189.63-71.766-2.514-7.3797-3.6904-10.832-3.7077-7.8964-0.0174-2.9357-1.1937 0.51669-3.7077 7.8964-13.714 40.255-67.233 197.36-189.63 71.766-64.444-66.128-34.605-132.26 82.697-152.22-67.108 11.421-142.55-7.4491-163.25-81.433-5.9562-21.282-16.111-152.36-16.111-170.07 0-88.687 77.742-60.816 125.72-24.795z"/></svg>';

// ── the slice of the app.bsky lexicons the embed reads ─────────────────────

interface Label {
	val: string;
}
interface Author {
	did: string;
	handle: string;
	displayName?: string;
	avatar?: string;
	labels?: Label[];
}
interface Facet {
	index?: { byteStart: number; byteEnd: number };
	features: Array<{ $type: string; uri?: string; did?: string; tag?: string }>;
}
interface PostRecord {
	text?: string;
	facets?: Facet[];
	createdAt: string;
}
interface AspectRatio {
	width: number;
	height: number;
}
interface Image {
	thumb: string;
	fullsize: string;
	alt: string;
	aspectRatio?: AspectRatio;
}
interface GalleryItem {
	thumbnail: string;
	fullsize?: string;
	alt: string;
	aspectRatio?: AspectRatio;
}
interface External {
	uri: string;
	title?: string;
	description?: string;
	thumb?: string;
}
interface Creator {
	did: string;
	handle: string;
}
type Embed =
	| { $type: 'app.bsky.embed.images#view'; images: Image[] }
	| { $type: 'app.bsky.embed.gallery#view'; items: GalleryItem[] }
	| { $type: 'app.bsky.embed.video#view'; thumbnail: string; alt?: string }
	| { $type: 'app.bsky.embed.external#view'; external: External }
	| { $type: 'app.bsky.embed.record#view'; record: EmbeddedRecord }
	| {
			$type: 'app.bsky.embed.recordWithMedia#view';
			media: Embed;
			record: { record: EmbeddedRecord };
	  };
type EmbeddedRecord =
	| {
			$type: 'app.bsky.embed.record#viewRecord';
			uri: string;
			author: Author;
			value: PostRecord;
			labels?: Label[];
			embeds?: Embed[];
	  }
	| { $type: 'app.bsky.embed.record#viewNotFound'; uri?: string }
	| { $type: 'app.bsky.embed.record#viewBlocked'; uri?: string }
	| { $type: 'app.bsky.embed.record#viewDetached'; uri?: string }
	| {
			$type: 'app.bsky.feed.defs#generatorView';
			uri: string;
			displayName: string;
			creator: Creator;
	  }
	| { $type: 'app.bsky.graph.defs#listView'; uri: string; name: string; creator: Creator }
	| {
			$type: 'app.bsky.graph.defs#starterPackViewBasic';
			uri: string;
			record: { name: string };
			creator: Creator;
	  };
interface PostView {
	uri: string;
	author: Author;
	record: PostRecord;
	labels?: Label[];
	embed?: Embed;
}
export interface Thread {
	$type: string;
	post: PostView;
	parent?: { post?: PostView };
}

// ── helpers ────────────────────────────────────────────────────────────────

const ESCAPES: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;'
};
const ESCAPED = /[&<>"']/g;
const escapeHtml = (str: unknown = '') => String(str).replace(ESCAPED, (char) => ESCAPES[char]);

const HTTP_URL = /^https?:\/\//i;
const isHttpUrl = (url?: string) => HTTP_URL.test(url || '');

const hasLabel = (labels: Label[] = [], test: (val: string) => boolean) =>
	labels.some((label) => test(label.val));

const optedOut = (post: { author: Author; labels?: Label[] }) =>
	hasLabel(post.author.labels, (val) => val === NO_UNAUTHENTICATED) ||
	hasLabel(post.labels, (val) => val === NO_UNAUTHENTICATED);

const isSensitive = (post: { labels?: Label[] }) =>
	hasLabel(post.labels, (val) => SENSITIVE_LABELS.has(val));

const profileUrl = (author: { did: string; handle: string }) =>
	`https://bsky.app/profile/${author.handle === 'handle.invalid' ? author.did : author.handle}`;

// at://did/app.bsky.feed.post/rkey → https://bsky.app/profile/handle/post/rkey
const postUrl = (author: Author, uri: string) =>
	`${profileUrl(author)}/post/${uri.split('/').pop()}`;

const formatDate = (iso: string) => readableDate(new Date(iso));

const WWW = /^www\./;

// ── fetching ───────────────────────────────────────────────────────────────

export interface FetchOptions {
	fetch?: typeof fetch;
	/** where threads are cached between builds (gitignored) */
	cacheDir?: string;
	now?: () => number;
}

const SAFE_NAME = /[^\w.-]/g;

// fetch a post (and its parent, for reply context) from the public AppView,
// caching it in the cache directory. a stale cache is used if the network is
// down, but a post the API says is gone stays gone.
export async function fetchThread(
	actor: string,
	rkey: string,
	{
		fetch: fetchFn = fetch,
		cacheDir = path.resolve('.cache/bluesky'),
		now = Date.now
	}: FetchOptions = {}
): Promise<Thread> {
	const cachePath = path.join(cacheDir, `${actor.replace(SAFE_NAME, '_')}-${rkey}.json`);
	const cached: { fetchedAt: number; thread: Thread } | null = fs.existsSync(cachePath)
		? JSON.parse(fs.readFileSync(cachePath, 'utf8'))
		: null;

	if (cached && now() - cached.fetchedAt < CACHE_MAX_AGE) {
		return cached.thread;
	}

	const params = new URLSearchParams({
		uri: `at://${actor}/app.bsky.feed.post/${rkey}`,
		depth: '0',
		parentHeight: '1'
	});

	let response: Response;
	try {
		response = await fetchFn(`${API}/app.bsky.feed.getPostThread?${params}`);
	} catch (error) {
		if (cached) {
			console.warn(
				`[bluesky-embed] Fetching ${actor}/${rkey} failed, using cached copy: ${(error as Error).message}`
			);
			return cached.thread;
		}
		throw error;
	}

	const body = (await response.json().catch(() => ({}))) as {
		thread?: Thread;
		error?: string;
		message?: string;
	};
	if (!response.ok) {
		if (body.error === 'NotFound') {
			fs.rmSync(cachePath, { force: true });
		} else if (cached) {
			console.warn(
				`[bluesky-embed] Fetching ${actor}/${rkey} failed, using cached copy: ${response.status}`
			);
			return cached.thread;
		}
		throw new Error(`${response.status} ${body.message || body.error || ''}`.trim());
	}

	fs.mkdirSync(cacheDir, { recursive: true });
	fs.writeFileSync(cachePath, JSON.stringify({ fetchedAt: now(), thread: body.thread }));
	return body.thread as Thread;
}

// ── rendering ──────────────────────────────────────────────────────────────

function facetHref(features: Facet['features'] = []): string | undefined {
	for (const feature of features) {
		switch (feature.$type) {
			case 'app.bsky.richtext.facet#link':
				if (isHttpUrl(feature.uri)) return feature.uri;
				break;
			case 'app.bsky.richtext.facet#mention':
				return `https://bsky.app/profile/${feature.did}`;
			case 'app.bsky.richtext.facet#tag':
				return `https://bsky.app/hashtag/${encodeURIComponent(feature.tag ?? '')}`;
		}
	}
}

// facet offsets index into the UTF-8 bytes of the text, not the JS string
export function renderRichText(text = '', facets: Facet[] = []): string {
	const bytes = Buffer.from(text, 'utf8');
	const slice = (start: number, end?: number) =>
		escapeHtml(bytes.subarray(start, end).toString('utf8'));
	const sorted = facets
		.filter((facet) => facet.index)
		.toSorted((a, b) => a.index!.byteStart - b.index!.byteStart);

	let html = '';
	let cursor = 0;
	for (const { index, features } of sorted) {
		const { byteStart, byteEnd } = index!;
		const href = facetHref(features);
		if (!href || byteStart < cursor || byteEnd <= byteStart || byteEnd > bytes.length) {
			continue;
		}
		html += `${slice(cursor, byteStart)}<a href="${escapeHtml(href)}">${slice(byteStart, byteEnd)}</a>`;
		cursor = byteEnd;
	}
	return html + slice(cursor);
}

const notice = (text: string, href?: string) =>
	href
		? `<a class="bsky-embed-notice" href="${escapeHtml(href)}">${escapeHtml(text)}</a>`
		: `<p class="bsky-embed-notice">${escapeHtml(text)}</p>`;

const sizeAttrs = (ratio?: AspectRatio) =>
	ratio?.width && ratio?.height ? ` width="${ratio.width}" height="${ratio.height}"` : '';

function renderImages(images: Image[]): string {
	const items = images.map(
		(image) =>
			`<a href="${escapeHtml(image.fullsize)}"><img src="${escapeHtml(image.thumb)}" alt="${escapeHtml(image.alt)}"${sizeAttrs(image.aspectRatio)} loading="lazy"></a>`
	);
	return `<div class="bsky-embed-images" data-count="${images.length}">${items.join('')}</div>`;
}

// 5+ photos show as a carousel in the app; a scroll-snapping strip does the
// same job here without any JS
function renderGallery(items: GalleryItem[], href: string): string {
	const slides = items.map(
		(item) =>
			`<a href="${escapeHtml(item.fullsize || href)}"><img src="${escapeHtml(item.thumbnail)}" alt="${escapeHtml(item.alt)}"${sizeAttrs(item.aspectRatio)} loading="lazy"></a>`
	);
	return `<div class="bsky-embed-gallery">${slides.join('')}</div>`;
}

// HLS playlists don't play natively outside Safari, so link a poster frame
// to the post instead of shipping a video player
function renderVideo(video: { thumbnail: string; alt?: string }, href: string): string {
	return (
		`<a class="bsky-embed-video" href="${escapeHtml(href)}" aria-label="Watch video on Bluesky">` +
		`<img src="${escapeHtml(video.thumbnail)}" alt="${escapeHtml(video.alt || '')}" loading="lazy">` +
		'<span class="bsky-embed-play" aria-hidden="true"></span></a>'
	);
}

function renderExternal({ uri, title, description, thumb }: External): string {
	if (!isHttpUrl(uri)) return '';
	const domain = new URL(uri).hostname.replace(WWW, '');
	return (
		`<a class="bsky-embed-external" href="${escapeHtml(uri)}">` +
		(thumb ? `<img src="${escapeHtml(thumb)}" alt="" loading="lazy">` : '') +
		'<span class="bsky-embed-external-body">' +
		`<span class="bsky-embed-external-domain">${escapeHtml(domain)}</span>` +
		`<strong>${escapeHtml(title || uri)}</strong>` +
		(description
			? `<span class="bsky-embed-external-description">${escapeHtml(description)}</span>`
			: '') +
		'</span></a>'
	);
}

// images, video, and link cards, on their own or alongside a quote
function renderMedia(embed: Embed | undefined, href: string): string {
	switch (embed?.$type) {
		case 'app.bsky.embed.images#view':
			return renderImages(embed.images);
		case 'app.bsky.embed.gallery#view':
			return renderGallery(embed.items, href);
		case 'app.bsky.embed.video#view':
			return renderVideo(embed, href);
		case 'app.bsky.embed.external#view':
			return renderExternal(embed.external);
		case 'app.bsky.embed.recordWithMedia#view':
			return renderMedia(embed.media, href);
		default:
			return '';
	}
}

const renderCard = (title: string, subtitle: string, href: string) =>
	`<a class="bsky-embed-external" href="${escapeHtml(href)}">` +
	`<span class="bsky-embed-external-body"><strong>${escapeHtml(title)}</strong>` +
	`<span class="bsky-embed-external-domain">${escapeHtml(subtitle)}</span></span></a>`;

// the thing a post quotes: usually another post, but feeds, lists, and
// starter packs can be quoted too
function renderRecord(record: EmbeddedRecord): string {
	const rkey = (record.uri || '').split('/').pop();

	switch (record.$type) {
		case 'app.bsky.embed.record#viewRecord': {
			const href = postUrl(record.author, record.uri);
			if (optedOut(record)) {
				return notice(
					'The author of the quoted post has requested their posts not be displayed on external sites.',
					href
				);
			}
			const { author, value } = record;
			const media = isSensitive(record)
				? notice('Media hidden: sensitive content. View on Bluesky.', href)
				: renderMedia((record.embeds || [])[0], href);
			return (
				'<div class="bsky-embed-quote">' +
				`<a class="bsky-embed-quote-header" href="${escapeHtml(href)}">` +
				(author.avatar
					? `<img class="bsky-embed-avatar" src="${escapeHtml(author.avatar)}" alt="" width="20" height="20" loading="lazy">`
					: '') +
				`<strong class="bsky-embed-name">${escapeHtml(author.displayName || author.handle)}</strong>` +
				`<span class="bsky-embed-handle">@${escapeHtml(author.handle)} · <time datetime="${escapeHtml(value.createdAt)}">${formatDate(value.createdAt)}</time></span></a>` +
				(value.text
					? `<p class="bsky-embed-text">${renderRichText(value.text, value.facets)}</p>`
					: '') +
				media +
				'</div>'
			);
		}
		case 'app.bsky.embed.record#viewNotFound':
			return notice('Quoted post not found, it may have been deleted.');
		case 'app.bsky.embed.record#viewBlocked':
			return notice('Quoted post is unavailable.');
		case 'app.bsky.embed.record#viewDetached':
			return notice('Quoted post removed by its author.');
		case 'app.bsky.feed.defs#generatorView':
			return renderCard(
				record.displayName,
				`Feed by @${record.creator.handle}`,
				`${profileUrl(record.creator)}/feed/${rkey}`
			);
		case 'app.bsky.graph.defs#listView':
			return renderCard(
				record.name,
				`List by @${record.creator.handle}`,
				`${profileUrl(record.creator)}/lists/${rkey}`
			);
		case 'app.bsky.graph.defs#starterPackViewBasic':
			return renderCard(
				record.record.name,
				`Starter pack by @${record.creator.handle}`,
				`https://bsky.app/starter-pack/${record.creator.handle}/${rkey}`
			);
		default:
			return '';
	}
}

function renderEmbed(embed: Embed | undefined, href: string): string {
	switch (embed?.$type) {
		case 'app.bsky.embed.record#view':
			return renderRecord(embed.record);
		case 'app.bsky.embed.recordWithMedia#view':
			return renderMedia(embed.media, href) + renderRecord(embed.record.record);
		default:
			return renderMedia(embed, href);
	}
}

function renderReplyContext(parent?: { post?: PostView }): string {
	const post = parent?.post;
	if (!post || optedOut(post)) return '';
	return `<p class="bsky-embed-context">Replying to <a href="${escapeHtml(profileUrl(post.author))}">@${escapeHtml(post.author.handle)}</a></p>`;
}

/** The embed for a thread, or null when it shouldn't be embedded (the link stays a link). */
export function renderPost(thread: Thread | undefined): string | null {
	if (!thread || thread.$type !== 'app.bsky.feed.defs#threadViewPost' || optedOut(thread.post)) {
		return null;
	}

	const { post, parent } = thread;
	const { author, record } = post;
	const href = postUrl(author, post.uri);
	const embed = isSensitive(post)
		? notice('Media hidden: sensitive content. View on Bluesky.', href)
		: renderEmbed(post.embed, href);

	return (
		`<blockquote class="bsky-embed" cite="${escapeHtml(href)}">` +
		'<div class="bsky-embed-header">' +
		`<a class="bsky-embed-author" href="${escapeHtml(profileUrl(author))}">` +
		(author.avatar
			? `<img class="bsky-embed-avatar" src="${escapeHtml(author.avatar)}" alt="" width="44" height="44" loading="lazy">`
			: '<span class="bsky-embed-avatar"></span>') +
		'<span class="bsky-embed-names">' +
		`<strong class="bsky-embed-name">${escapeHtml(author.displayName || author.handle)}</strong>` +
		`<span class="bsky-embed-handle">@${escapeHtml(author.handle)}</span>` +
		'</span></a>' +
		`<a class="bsky-embed-logo" href="${escapeHtml(href)}" aria-label="View on Bluesky">${BUTTERFLY}</a>` +
		'</div>' +
		renderReplyContext(parent) +
		(record.text
			? `<p class="bsky-embed-text">${renderRichText(record.text, record.facets)}</p>`
			: '') +
		embed +
		'<footer class="bsky-embed-footer">' +
		`<a href="${escapeHtml(href)}"><time datetime="${escapeHtml(record.createdAt)}">${formatDate(record.createdAt)}</time></a>` +
		`<a href="${escapeHtml(href)}">View on Bluesky</a>` +
		'</footer></blockquote>'
	);
}

// one fetch per post per build
const threads = new Map<string, Promise<Thread>>();

function getThread(actor: string, rkey: string, options: FetchOptions): Promise<Thread> {
	const key = `${actor}/${rkey}`;
	let thread = threads.get(key);
	if (!thread) {
		thread = fetchThread(actor, rkey, options).catch((error) => {
			threads.delete(key);
			throw error;
		});
		threads.set(key, thread);
	}
	return thread;
}

/** Forget fetched threads (tests, or a long-running dev server). */
export function clearThreads(): void {
	threads.clear();
}

/** Replace each standalone bsky.app post link in rendered HTML with an embed. */
export async function embedBlueskyPosts(html: string, options: FetchOptions = {}): Promise<string> {
	const matches = [...html.matchAll(STANDALONE_POST_LINK)];
	if (matches.length === 0) return html;

	const embeds = await Promise.all(
		matches.map(async ([, url, actor, rkey]) => {
			try {
				const embed = renderPost(await getThread(actor, rkey, options));
				if (!embed) {
					console.warn(
						`[bluesky-embed] ${url} can't be shown on external sites, leaving it as a link`
					);
				}
				return embed;
			} catch (error) {
				console.warn(
					`[bluesky-embed] Couldn't embed ${url}, leaving it as a link: ${(error as Error).message}`
				);
				return null;
			}
		})
	);

	let i = 0;
	return html.replace(STANDALONE_POST_LINK, (match) => embeds[i++] || match);
}
