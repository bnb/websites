// <standard-site-subscribe publication="at://…"> lets a reader subscribe to a
// standard.site publication from any ATProto account (Bluesky or otherwise)
// by writing a site.standard.graph.subscription record to their own repo.
//
// It stays light until clicked: checking whether a returning reader is
// subscribed is a public read, and the OAuth client loads only when needed.
// It renders into the light DOM, so it's styled with the site's own CSS.
import { moveToLoopback } from '@bnb/atmosphere';
import { SUBSCRIPTION } from '../constants';
import { AT_SIGN, clientConfig, escapeHtml, pending, storage } from './shared';

const TIMEOUT = 15_000;

// the script is served from /standard-site/, next to the OAuth metadata and
// callback page, so their URLs follow from this file's own (kept in a
// variable so the bundler leaves them alone)
const here = import.meta.url;
const config = (handleResolver?: string | null) => clientConfig(here, handleResolver);

const loadOAuth = () => import('./oauth');

async function resolvePds(did: string): Promise<string> {
	const url = did.startsWith('did:web:')
		? `https://${decodeURIComponent(did.slice('did:web:'.length))}/.well-known/did.json`
		: `https://plc.directory/${did}`;
	const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
	if (!response.ok) throw new Error(`Couldn't resolve ${did}`);
	const doc = (await response.json()) as {
		service?: Array<{ id: string; serviceEndpoint: string }>;
	};
	const service = (doc.service || []).find((entry) => entry.id.endsWith('#atproto_pds'));
	if (!service) throw new Error(`${did} has no PDS`);
	return service.serviceEndpoint;
}

/**
 * The rkeys of `did`'s subscriptions to `publication` (usually one), read
 * straight from their PDS without signing in.
 */
export async function findSubscriptions(did: string, publication: string): Promise<string[]> {
	const pds = await resolvePds(did);
	const rkeys: string[] = [];
	let cursor: string | undefined;
	do {
		const url = new URL('/xrpc/com.atproto.repo.listRecords', pds);
		url.searchParams.set('repo', did);
		url.searchParams.set('collection', SUBSCRIPTION);
		url.searchParams.set('limit', '100');
		if (cursor) url.searchParams.set('cursor', cursor);
		const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
		if (!response.ok) throw new Error(`Couldn't list subscriptions: ${response.status}`);
		const page = (await response.json()) as {
			records: Array<{ uri: string; value: { publication?: string } }>;
			cursor?: string;
		};
		for (const record of page.records) {
			if (record.value.publication === publication) rkeys.push(record.uri.split('/').pop()!);
		}
		cursor = page.records.length ? page.cursor : undefined;
	} while (cursor);
	return rkeys;
}

type State = 'idle' | 'form' | 'busy' | 'subscribed';
type Action = 'subscribe' | 'unsubscribe';

export class StandardSiteSubscribe extends HTMLElement {
	publication = '';
	label = 'Subscribe';
	config = config();

	connectedCallback() {
		this.publication = this.getAttribute('publication') ?? '';
		this.label = this.getAttribute('label') || 'Subscribe';
		this.config = config(this.getAttribute('handle-resolver'));
		this.render('idle');
		void this.refresh();
	}

	async refresh() {
		const did = storage.get();
		if (!did) return;
		try {
			this.render((await findSubscriptions(did, this.publication)).length ? 'subscribed' : 'idle');
		} catch {
			// can't tell; leave the button as it is
		}
	}

	render(state: State, message = '') {
		this.dataset.state = state;
		const busy = state === 'busy';
		let body: string;
		if (state === 'form') {
			body =
				'<form class="standard-site-subscribe-form">' +
				'<label for="standard-site-handle">Your handle</label>' +
				'<input id="standard-site-handle" name="handle" type="text" placeholder="you.bsky.social" autocomplete="username" autocapitalize="none" spellcheck="false" required>' +
				'<button type="submit">Continue</button>' +
				'<button type="button" data-action="cancel">Cancel</button>' +
				'</form>' +
				'<p class="standard-site-subscribe-hint">Works with any Atmosphere account, Bluesky included.</p>';
		} else if (state === 'subscribed') {
			body =
				'<p class="standard-site-subscribe-status">You\'re subscribed.</p>' +
				'<button type="button" data-action="unsubscribe">Unsubscribe</button>';
		} else {
			body = `<button type="button" data-action="subscribe"${busy ? ' disabled' : ''}>${busy ? 'Working…' : escapeHtml(this.label)}</button>`;
		}
		this.innerHTML =
			body +
			(message
				? `<p class="standard-site-subscribe-error" role="alert">${escapeHtml(message)}</p>`
				: '');

		const form = this.querySelector('form');
		if (form) {
			const input = form.elements.namedItem('handle') as HTMLInputElement;
			form.addEventListener('submit', (event) => {
				event.preventDefault();
				void this.start('subscribe', input.value.trim().replace(AT_SIGN, ''));
			});
			input.focus();
		}
		for (const button of this.querySelectorAll<HTMLElement>('[data-action]')) {
			button.addEventListener('click', () => this.onAction(button.dataset.action!));
		}
	}

	onAction(action: string) {
		if (action === 'cancel') {
			this.render('idle');
		} else if (action === 'subscribe' && !storage.get()) {
			this.render('form');
		} else {
			void this.start(action as Action, storage.get());
		}
	}

	// reuse a saved session if there is one, otherwise sign in (which leaves
	// the page and finishes on the callback page)
	async start(action: Action, identity: string | null) {
		// local dev signs in from 127.0.0.1, where the callback lands
		if (moveToLoopback()) return;
		this.render('busy');
		try {
			const oauth = await loadOAuth();
			const session = identity?.startsWith('did:')
				? await oauth.restore(this.config, identity)
				: null;
			if (session) {
				await oauth[action](session, this.publication, findSubscriptions);
				this.render(action === 'subscribe' ? 'subscribed' : 'idle');
				return;
			}
			await oauth.signIn(this.config, identity ?? '', {
				action,
				publication: this.publication,
				returnTo: window.location.href
			});
		} catch (error) {
			this.render(
				action === 'subscribe' && !storage.get() ? 'form' : 'idle',
				(error as Error).message
			);
		}
	}
}

/**
 * The callback page: finish signing in, do what the reader asked (a
 * subscription here; an upvote or comment is kept for the post page to finish),
 * and send them back where they came from.
 */
export async function handleCallback() {
	const status = document.querySelector('[data-standard-site-status]');
	const home = new URL('..', here).href;
	try {
		const oauth = await loadOAuth();
		const { session, state, cancelled } = await oauth.callback(
			config(document.documentElement.dataset.handleResolver)
		);
		if (!cancelled && session) {
			storage.set(session.did);
			if (state.pending) pending.set(state.pending);
			if (state.action === 'subscribe' || state.action === 'unsubscribe') {
				await oauth[state.action](session, state.publication!, findSubscriptions);
			}
		}
		const returnTo = new URL(state.returnTo || home, window.location.origin);
		window.location.replace(returnTo.origin === window.location.origin ? returnTo.href : home);
	} catch (error) {
		if (status) {
			status.innerHTML = `Something went wrong: ${escapeHtml((error as Error).message)}. <a href="${home}">Head back</a> and try again.`;
		}
	}
}

if (document.documentElement.hasAttribute('data-standard-site-callback')) {
	void handleCallback();
} else if (!customElements.get('standard-site-subscribe')) {
	customElements.define('standard-site-subscribe', StandardSiteSubscribe);
}
