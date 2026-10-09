// Build-time syntax highlighting with Prism, in the markup the posts have
// always had: <pre class="language-x"><code class="language-x">…</code></pre>, with
// language aliases, `diff` and `diff-<lang>` blocks, and `text` (or a language
// Prism doesn't know) passed through as is. Line highlights (```js/1-2) aren't
// supported; no post uses them.
import { createRequire } from 'node:module';

interface Grammar {
	[token: string]: unknown;
}
interface PrismLike {
	languages: Record<string, Grammar | undefined> & { diff?: Grammar };
	highlight(text: string, grammar: Grammar, language: string): string;
}

// Prism's language loader and the diff-highlight plugin are CommonJS that
// register onto the global Prism, so they're loaded with require.
const require = createRequire(import.meta.url);
const Prism: PrismLike = require('prismjs');
const loadLanguages: ((languages: string) => void) & {
	silent?: boolean;
} = require('prismjs/components/index.js');
const components: {
	languages: Record<string, { alias?: string | string[] }>;
} = require('prismjs/components.json');
loadLanguages.silent = true;
require('prismjs/components/prism-diff.js');
require('prismjs/plugins/diff-highlight/prism-diff-highlight');

/** `ts` → `typescript`: Prism's loader doesn't always resolve aliases itself. */
export function normalizeLanguage(language: string): string {
	if (components.languages[language]) return language;
	for (const [key, { alias }] of Object.entries(components.languages)) {
		if (Array.isArray(alias) ? alias.includes(language) : alias === language) return key;
	}
	return language;
}

function grammarFor(language: string): Grammar | undefined {
	const isDiff = language.startsWith('diff-');
	const name = normalizeLanguage(isDiff ? language.slice('diff-'.length) : language);
	if (!Prism.languages[name]) loadLanguages(name);
	if (!isDiff) return Prism.languages[name];
	// diff-js etc. tokenize as a diff; the diff-highlight plugin colours the code
	Prism.languages[`diff-${name}`] = Prism.languages.diff;
	return Prism.languages[`diff-${name}`];
}

/** markdown-it's `highlight` option. An empty string defers to markdown-it's own escaping. */
export function highlight(code: string, info: string): string {
	if (!info) return '';
	const language = info.split('/')[0];
	let html = code;
	if (language !== 'text') {
		const grammar = grammarFor(language);
		if (grammar) html = Prism.highlight(code, grammar, language);
	}
	const lines = html.split('\n');
	if (lines.at(-1) === '') lines.pop();
	const attrs = ` class="language-${language}"`;
	return `<pre${attrs}><code${attrs}>${lines.join('\n')}</code></pre>`;
}
