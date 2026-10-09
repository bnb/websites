import { parse } from 'yaml';

/**
 * YAML front matter, the way posts have always been written: a `---` line at
 * the very start, the YAML, and a closing `---` line. Dates stay strings
 * (YAML 1.2), which posts.ts reads as midnight UTC.
 */
export interface FrontMatter {
	data: Record<string, unknown>;
	/** what follows the closing `---` line */
	content: string;
}

const OPEN = /^﻿?---[ \t]*\r?\n/;
const CLOSE = /^---[ \t]*$/m;
const LINE_BREAK = /^\r?\n/;

export function frontMatter(source: string): FrontMatter {
	const open = OPEN.exec(source);
	if (!open) return { data: {}, content: source };
	const rest = source.slice(open[0].length);
	const close = CLOSE.exec(rest);
	if (!close) throw new Error('Front matter has no closing ---');
	const data: unknown = parse(rest.slice(0, close.index)) ?? {};
	if (typeof data !== 'object' || Array.isArray(data)) {
		throw new Error('Front matter has to be a YAML mapping');
	}
	return {
		data: data as Record<string, unknown>,
		content: rest.slice(close.index + close[0].length).replace(LINE_BREAK, '')
	};
}
