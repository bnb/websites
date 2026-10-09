import { SERIES } from '../series';
import { frontMatter } from './front-matter';
import { md } from './markdown';

export interface Post {
	/** the file name without .md, which is also the URL slug */
	slug: string;
	/** the source file, from the app root: "/posts/is-mdm.md" */
	file: string;
	url: string;
	title: string;
	description?: string;
	date: Date;
	updatedAt?: Date;
	topic?: string;
	/** as written in the front matter, including the `post` collection tag */
	tags: string[];
	series?: string;
	part?: string;
	atUri?: string;
	draft: boolean;
	/** the Markdown after the front matter */
	source: string;
	/** rendered HTML, before Bluesky links become embeds */
	html: string;
}

export interface SeriesPost {
	title: string;
	description?: string;
	date: Date;
	url: string;
	part?: string;
}

export interface Series {
	slug: string;
	title: string;
	description: string;
	/** the newest part's date */
	date: Date;
	posts: SeriesPost[];
}

const FILE = /^\/posts\/(.+)\.md$/;

/** Marks where a post's excerpt ends. It's taken out of the post itself. */
export const EXCERPT_SEPARATOR = '<!-- excerpt -->';

/**
 * Front matter, then the body with the first excerpt separator removed (and
 * the excerpt trimmed when a line break follows it), the way the posts have
 * always been read.
 */
function readFrontMatter(raw: string) {
	const { data, content } = frontMatter(raw);
	const at = content.indexOf(EXCERPT_SEPARATOR);
	if (at <= 0) return { data, content };
	const excerpt = content.slice(0, at);
	const rest = content.slice(at + EXCERPT_SEPARATOR.length);
	return {
		data,
		content: rest.startsWith('\n') ? `${excerpt.trim()}\n${rest.slice(1)}` : excerpt + rest
	};
}

// YAML dates stay strings; a date-only one ("2021-06-16") is midnight UTC
const toDate = (value: unknown): Date | undefined =>
	value instanceof Date ? value : value ? new Date(String(value)) : undefined;

/** Parse one post. Front matter dates are midnight UTC. */
export function parsePost(file: string, raw: string): Post {
	const slug = FILE.exec(file)?.[1];
	if (!slug) throw new Error(`Not a post: ${file}`);
	const { data, content } = readFrontMatter(raw);
	const date = toDate(data.date);
	if (!date || Number.isNaN(date.getTime())) throw new Error(`${file} has no valid date`);
	return {
		slug,
		file,
		url: `/posts/${slug}/`,
		title: String(data.title),
		description: data.description as string | undefined,
		date,
		updatedAt: toDate(data.updatedAt ?? data.updated),
		topic: data.topic as string | undefined,
		tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
		series: data.series as string | undefined,
		part: data.part === undefined ? undefined : String(data.part),
		atUri: data.atUri as string | undefined,
		draft: data.draft === true,
		source: content,
		html: md.render(content)
	};
}

/** Oldest first; posts on the same day sort by file name. */
export function sortPosts(posts: Post[]): Post[] {
	return posts.toSorted(
		(a, b) =>
			a.date.getTime() - b.date.getTime() || (a.file < b.file ? -1 : a.file > b.file ? 1 : 0)
	);
}

export function parsePosts(files: Record<string, string>): Post[] {
	return sortPosts(Object.entries(files).map(([file, raw]) => parsePost(file, raw)));
}

/** Every post `topic`, most recently written about first. */
export function topics(posts: readonly Post[]): string[] {
	return [...new Set(posts.toReversed().flatMap((post) => (post.topic ? [post.topic] : [])))];
}

export function seriesTotal(posts: readonly Post[], series: string): number {
	return posts.filter((post) => post.series === series).length;
}

/** Series with more than one post, each ordered by part. */
export function collectSeries(posts: readonly Post[]): Series[] {
	const mapping = new Map<string, Series>();
	for (const post of posts) {
		if (post.series === undefined) continue;
		const data = SERIES[post.series];
		if (!data)
			throw new Error(`${post.file} names series "${post.series}", which isn't in series.ts`);
		const entry = mapping.get(post.series) ?? {
			slug: post.series,
			title: data.title,
			description: data.description,
			date: post.date,
			posts: []
		};
		entry.posts.push({
			title: post.title,
			description: post.description,
			date: post.date,
			url: post.url,
			part: post.part
		});
		entry.date = post.date;
		mapping.set(post.series, entry);
	}
	const collected = [...mapping.values()].filter((series) => series.posts.length > 1);
	for (const series of collected) {
		// same-day parts tie on date, so order by part
		series.posts.sort((a, b) => Number(a.part) - Number(b.part));
	}
	return collected;
}

let cached: Post[] | undefined;

/** Every post in posts/, oldest first. */
export function loadPosts(): Post[] {
	cached ??= parsePosts(
		import.meta.glob<string>('/posts/*.md', { query: '?raw', import: 'default', eager: true })
	);
	return cached;
}

export function findPost(slug: string): Post | undefined {
	return loadPosts().find((post) => post.slug === slug);
}
