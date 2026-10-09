// <standard-site-upvote subject="at://…"> upvotes a document (a post) with
// upvote.at's at.upvote.signal, written to the reader's own repo. The count is
// Constellation's, and so is whether a reader who signed in here before has
// upvoted it. It renders into the light DOM, styled by the site's own CSS.
import { countLinks, listLinks } from '@bnb/atmosphere';
import { UPVOTE } from '../constants';
import { h } from './dom';
import { pending, storage, type Pending } from './shared';
import { askToSignIn } from './sign-in';
import { SIGN_IN, type Writer } from './writer';

type Upvote = Extract<Pending, { kind: 'upvote' }>;

export class StandardSiteUpvote extends HTMLElement {
	/** set by the script before the element is defined */
	static writer: Writer;

	subject = '';
	#count: number | undefined;
	#on = false;
	#busy = false;
	readonly #button = h('button', { type: 'button', 'aria-pressed': 'false' });
	readonly #number = h('span', { class: 'standard-site-count' });
	readonly #error = h('p', { class: 'standard-site-error', role: 'alert' });

	connectedCallback() {
		this.subject = this.getAttribute('subject') ?? '';
		this.#button.append(
			h('span', { class: 'standard-site-arrow', 'aria-hidden': 'true' }, '▲'),
			' Upvote ',
			this.#number
		);
		this.#button.addEventListener('click', () => void this.toggle());
		this.replaceChildren(this.#button, this.#error);
		this.#render();
		void this.refresh();
	}

	get #links() {
		return { target: this.subject, collection: UPVOTE, path: '.subject' };
	}

	/** Reads the count and, for a returning reader, whether they've upvoted; then finishes an upvote they signed in to make. */
	async refresh() {
		const did = storage.get();
		const [count, mine] = await Promise.all([
			countLinks(this.#links).catch(() => undefined),
			did
				? listLinks({ ...this.#links, did, limit: 1 }).then(
						(page) => page.total > 0,
						() => false
					)
				: false
		]);
		this.#count = count;
		this.#on = mine;
		this.#render();
		const action = pending.take(
			(candidate): candidate is Upvote =>
				candidate.kind === 'upvote' && candidate.subject === this.subject
		);
		if (action && action.on !== this.#on) await this.#set(action.on, false);
	}

	async toggle() {
		if (this.#busy) return;
		await this.#set(!this.#on, true);
	}

	// optimistic for a reader who's signed in here: the button changes at once,
	// and changes back if the write fails
	async #set(on: boolean, again: boolean) {
		const signedIn = Boolean(storage.get());
		const action: Upvote = { kind: 'upvote', subject: this.subject, on };
		this.#busy = true;
		this.#error.textContent = '';
		if (signedIn) this.#apply(on);
		try {
			const outcome = await StandardSiteUpvote.writer.act(
				action,
				(oauth, session) => oauth.upvote(session, this.subject, on),
				{ again }
			);
			if (outcome === SIGN_IN) {
				askToSignIn((handle) => StandardSiteUpvote.writer.signIn(handle, action));
			}
		} catch {
			if (signedIn) this.#apply(!on);
			this.#error.textContent = on
				? "Couldn't save your upvote."
				: "Couldn't take back your upvote.";
		} finally {
			this.#busy = false;
		}
	}

	#apply(on: boolean) {
		this.#on = on;
		if (this.#count !== undefined) this.#count = Math.max(0, this.#count + (on ? 1 : -1));
		this.#render();
	}

	#render() {
		const count = this.#count;
		this.#button.setAttribute('aria-pressed', String(this.#on));
		this.#button.setAttribute(
			'aria-label',
			count ? `Upvote, ${count} ${count === 1 ? 'upvote' : 'upvotes'}` : 'Upvote'
		);
		this.#number.textContent = count ? String(count) : '';
	}
}
