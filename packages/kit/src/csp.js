// The Content-Security-Policy every site starts from, for svelte.config.js.
// Plain JavaScript (with JSDoc types) because svelte.config.js is loaded by
// Node directly, before any TypeScript tooling runs.
//
// Hashes rather than nonces: the pages are publicly cacheable (s-maxage, or
// static files), and a cached nonce would be the same for everyone. SvelteKit
// hashes its own inline scripts; appScriptHash covers the one in app.html.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const APP_SCRIPT = /<script>([\s\S]*?)<\/script>/;

/**
 * The sha256 source for the inline script in an app.html template, read from
 * the template itself so the two can never drift apart. Null when there's none.
 *
 * @param {URL | string} template
 * @returns {`sha256-${string}` | null}
 */
export function appScriptHash(template) {
	const script = readFileSync(template, 'utf8').match(APP_SCRIPT)?.[1];
	if (script === undefined) return null;
	return `sha256-${createHash('sha256').update(script).digest('base64')}`;
}

/**
 * @typedef {NonNullable<import('@sveltejs/kit').KitConfig['csp']>} CspConfig
 * @typedef {NonNullable<CspConfig['directives']>} CspDirectives
 * @typedef {NonNullable<CspDirectives['img-src']>[number]} Source
 * @typedef {{
 *   scripts?: Source[],
 *   images?: Source[],
 *   media?: Source[],
 *   connect?: Source[],
 *   frameAncestors?: boolean
 * }} CspOptions
 */

/**
 * SvelteKit `kit.csp` config: 'self' for everything, plus what a site adds.
 * `frameAncestors: false` leaves out frame-ancestors, which browsers ignore
 * (with a console error) when the policy arrives in a <meta> tag, as it does
 * on a statically hosted site.
 *
 * @param {CspOptions} [options]
 * @returns {CspConfig}
 */
export function contentSecurityPolicy({
	scripts = [],
	images = [],
	media = [],
	connect = [],
	frameAncestors = true
} = {}) {
	/** @type {CspDirectives} */
	const directives = {
		'default-src': ['self'],
		'script-src': ['self', ...scripts],
		'style-src': ['self', 'unsafe-inline'],
		'img-src': ['self', 'data:', ...images],
		'font-src': ['self'],
		'connect-src': ['self', ...connect],
		'object-src': ['none'],
		'base-uri': ['self'],
		'form-action': ['self']
	};
	if (media.length) directives['media-src'] = ['self', ...media];
	if (frameAncestors) directives['frame-ancestors'] = ['none'];
	return { mode: 'hash', directives };
}
