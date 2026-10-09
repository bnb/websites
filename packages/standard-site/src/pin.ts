// Writes `atUri` into the front matter of posts that didn't have one yet, so
// a post keeps its record even if its date or slug change later.
import fs from 'node:fs';

// templates written in JavaScript have no front matter to write to
const JS_TEMPLATE = /\.(?:[cm]?js|[cm]?ts|jsx|tsx)$/;
const OPEN = /^﻿?---([^\r\n]*)\r?\n/;
const CLOSE = /(^|\r?\n)---/;
const EXISTING = /^atUri[ \t]*:.*$/m;

interface FrontMatter {
	unclosed?: boolean;
	language?: string;
	start?: number;
	end?: number;
}

// the front matter: from a --- line at the very start, optionally naming its
// language, to the next line starting with --- (or, with no such line, the end)
function frontMatter(source: string): FrontMatter | null {
	const open = OPEN.exec(source);
	if (!open) return null;
	const close = CLOSE.exec(source.slice(open[0].length));
	if (!close) return { unclosed: true };
	return {
		language: open[1].trim().toLowerCase() || 'yaml',
		start: open[0].length,
		end: open[0].length + close.index + close[1].length
	};
}

/** Why `doc`'s atUri can't be pinned, or null if it can. */
export function pinProblem(doc: { inputPath: string }): string | null {
	if (JS_TEMPLATE.test(doc.inputPath)) return 'is a JavaScript template, which has no front matter';
	let source: string;
	try {
		source = fs.readFileSync(doc.inputPath, 'utf8');
	} catch (error) {
		return `can't be read (${(error as NodeJS.ErrnoException).code})`;
	}
	const matter = frontMatter(source);
	if (matter?.unclosed) return 'has front matter with no closing ---';
	if (matter && !['yaml', 'yml'].includes(matter.language!)) {
		return `has ${matter.language} front matter, which only YAML is written to`;
	}
	return null;
}

export function pinAtUri(doc: { inputPath: string; uri: string }): void {
	const problem = pinProblem(doc);
	if (problem) throw new Error(`${doc.inputPath} ${problem}`);
	const source = fs.readFileSync(doc.inputPath, 'utf8');
	const newline = source.includes('\r\n') ? '\r\n' : '\n';
	const line = `atUri: "${doc.uri}"`;
	const matter = frontMatter(source);
	if (!matter) {
		const bom = source.startsWith('﻿') ? '﻿' : '';
		fs.writeFileSync(
			doc.inputPath,
			`${bom}---${newline}${line}${newline}---${newline}${source.slice(bom.length)}`
		);
		return;
	}
	const body = source.slice(matter.start, matter.end);
	// an empty atUri (a placeholder, say) is filled in rather than repeated,
	// which YAML wouldn't allow
	const updated = EXISTING.test(body) ? body.replace(EXISTING, line) : `${body}${line}${newline}`;
	fs.writeFileSync(
		doc.inputPath,
		source.slice(0, matter.start) + updated + source.slice(matter.end)
	);
}
