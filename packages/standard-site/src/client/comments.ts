// <standard-site-comments subject="at://…" hide="at://… did:…"> shows the
// comments on a document (a post), written with upvote.at's at.upvote.comment:
// oldest first, replies threaded MAX_DEPTH deep, earlier ones a click away.
// Readers can comment, reply and delete their own. Whatever the page put inside
// it (ghost lines) shows while it loads. It renders into the light DOM, styled
// by the site's own CSS.
import { moveToLoopback } from '@bnb/atmosphere';
import { composer } from './composer';
import { h } from './dom';
import { pending, storage, type Pending } from './shared';
import { askToSignIn } from './sign-in';
import { handleOf, limiter, loadComments, type Comment } from './thread';
import { LEAVING, SIGN_IN, type Writer } from './writer';

/** levels of comments shown: the post's, and three of replies */
export const MAX_DEPTH = 4;
const PAGE = 25;
const REPLIES = 10;
const DATE = new Intl.DateTimeFormat('en', { dateStyle: 'medium' });
const SPACES = /\s+/;

type Mine = Extract<Pending, { kind: 'comment' | 'delete' | 'compose' }>;

interface Shown {
	comment: Comment;
	depth: number;
	item: HTMLLIElement;
	article: HTMLElement;
	actions: HTMLElement;
	replies: HTMLOListElement;
	repliesBox: HTMLElement;
	composer?: HTMLFormElement;
}

let markdown: Promise<(text: string) => string> | undefined;
const loadMarkdown = () =>
	(markdown ??= import('./markdown').then(({ renderMarkdown }) => renderMarkdown));

let made = 0;

export class StandardSiteComments extends HTMLElement {
	/** set by the script before the element is defined */
	static writer: Writer;

	subject = '';
	#hide = new Set<string>();
	#loading: Node[] = [];
	readonly #shown = new Map<string, Shown>();
	/** deleted this page view, so a later page doesn't bring them back */
	readonly #gone = new Set<string>();
	/** a reply they signed in to write, opened when its comment shows */
	#resume: string | null = null;
	/** reply threads load a couple at a time */
	readonly #queue = limiter(2);
	readonly #thread = h('div', { class: 'standard-site-replies' });
	readonly #list = h('ol', { class: 'standard-site-thread' });
	readonly #empty = h('p', { class: 'standard-site-empty', tabindex: '-1' }, 'No comments yet.');
	readonly #account = h('p', { class: 'standard-site-account' });
	readonly #compose = h('div', { class: 'standard-site-compose' });
	readonly #status = h('p', { class: 'standard-site-status', role: 'status' });
	#box: HTMLTextAreaElement | undefined;
	#composeError: HTMLElement | undefined;

	connectedCallback() {
		this.subject = this.getAttribute('subject') ?? '';
		this.#hide = new Set((this.getAttribute('hide') ?? '').split(SPACES).filter(Boolean));
		this.#loading = [...this.childNodes];
		void this.load();
	}

	get #writer() {
		return StandardSiteComments.writer;
	}

	/** Loads the newest page of comments (and their replies), then finishes anything the reader signed in to do. */
	async load() {
		this.replaceChildren(...this.#loading);
		this.#thread.replaceChildren(this.#list);
		this.#list.replaceChildren();
		this.#shown.clear();
		try {
			await this.#page(this.subject, this.#thread, this.#list, 0);
		} catch {
			this.replaceChildren(
				h(
					'p',
					{ class: 'standard-site-error' },
					h('span', {}, "Couldn't load the comments."),
					' ',
					h('button', { type: 'button', onclick: () => void this.load() }, 'Try again')
				)
			);
			return;
		}
		this.#renderAccount();
		this.#renderCompose();
		this.replaceChildren(this.#account, this.#thread, this.#empty, this.#compose, this.#status);
		this.#syncEmpty();
		await this.#finishPending();
	}

	/**
	 * Shows a page of `subject`'s comments at the top of `list` (each page is
	 * older than the last), with a button for the page before.
	 */
	async #page(
		subject: string,
		box: HTMLElement,
		list: HTMLOListElement,
		depth: number,
		cursor?: string
	) {
		const page = await loadComments(subject, {
			hide: this.#hide,
			limit: depth ? REPLIES : PAGE,
			cursor
		});
		const fresh = page.comments.filter(({ uri }) => !this.#shown.has(uri) && !this.#gone.has(uri));
		list.prepend(...(await Promise.all(fresh.map((comment) => this.#item(comment, depth)))));
		box.querySelector(':scope > .standard-site-earlier')?.remove();
		if (page.cursor) {
			const earlier = h(
				'button',
				{ type: 'button', class: 'standard-site-earlier' },
				depth ? 'Show earlier replies' : 'Show earlier comments'
			);
			earlier.addEventListener('click', async () => {
				earlier.disabled = true;
				await this.#page(subject, box, list, depth, page.cursor!).catch(() => {
					earlier.disabled = false;
					earlier.textContent = "Couldn't load them. Try again";
				});
			});
			box.prepend(earlier);
		}
		for (const { uri } of fresh) if (uri === this.#resume) this.#reply(this.#shown.get(uri)!);
	}

	async #item(comment: Comment, depth: number, { fresh = false } = {}): Promise<HTMLLIElement> {
		const render = await loadMarkdown();
		const id = `standard-site-comment-${++made}`;
		const body = h('div', { class: 'standard-site-body' });
		body.innerHTML = render(comment.text);
		const actions = h('div', { class: 'standard-site-actions' });
		const article = h(
			'article',
			{ tabindex: '-1', 'aria-labelledby': id },
			h(
				'header',
				{ id },
				h('span', { class: 'standard-site-author' }, author(comment)),
				' ',
				h('time', { datetime: comment.createdAt }, DATE.format(new Date(comment.createdAt)))
			),
			body,
			actions
		);
		const replies = h('ol', { class: 'standard-site-thread' });
		const repliesBox = h('div', { class: 'standard-site-replies' }, replies);
		const deeper = depth + 1 < MAX_DEPTH;
		const item = h('li', { class: 'standard-site-comment' }, article, deeper && repliesBox);
		const shown: Shown = { comment, depth, item, article, actions, replies, repliesBox };
		this.#shown.set(comment.uri, shown);
		this.#renderActions(shown);
		if (deeper && !fresh) void this.#replies(shown);
		return item;
	}

	async #replies(shown: Shown) {
		const { comment, repliesBox, replies, depth } = shown;
		try {
			await this.#queue(() => this.#page(comment.uri, repliesBox, replies, depth + 1));
		} catch {
			const retry = h('button', { type: 'button' }, 'Try again');
			const problem = h(
				'p',
				{ class: 'standard-site-error' },
				h('span', {}, "Couldn't load the replies."),
				' ',
				retry
			);
			retry.addEventListener('click', () => {
				problem.remove();
				void this.#replies(shown);
			});
			repliesBox.prepend(problem);
		}
	}

	#renderActions(shown: Shown) {
		const { comment, depth, actions } = shown;
		const mine = Boolean(comment.uri) && storage.get() === comment.did;
		actions.replaceChildren(
			...[
				depth + 1 < MAX_DEPTH &&
					h(
						'button',
						{
							type: 'button',
							'data-action': 'reply',
							'aria-label': `Reply to ${author(comment)}`,
							onclick: () => this.#reply(shown)
						},
						'Reply'
					),
				mine &&
					h(
						'button',
						{
							type: 'button',
							'data-action': 'delete',
							'aria-label': 'Delete your comment',
							onclick: () => this.#confirmDelete(shown)
						},
						'Delete'
					)
			].filter((button) => button !== false)
		);
	}

	#askToSignIn(action: Mine) {
		if (moveToLoopback()) return;
		askToSignIn((handle) => this.#writer.signIn(handle, action));
	}

	#reply(shown: Shown) {
		this.#resume = null;
		const { comment } = shown;
		if (!storage.get()) {
			this.#askToSignIn({ kind: 'compose', subject: comment.uri, rootSubject: this.subject });
			return;
		}
		if (shown.composer) {
			shown.composer.querySelector('textarea')!.focus();
			return;
		}
		const close = () => {
			form.remove();
			shown.composer = undefined;
		};
		const { form, box } = composer({
			label: `Your reply to ${author(comment)}`,
			action: 'Reply',
			post: (text) => this.#post(comment.uri, text),
			cancel: () => {
				close();
				shown.actions.querySelector<HTMLElement>('[data-action="reply"]')!.focus();
			}
		});
		shown.composer = form;
		shown.article.after(form);
		box.focus();
	}

	/**
	 * Posts a comment on `subject` (the post, or a comment it replies to) and
	 * shows it at once: Constellation takes a moment to see it, and when it does,
	 * the same comment isn't shown twice.
	 */
	async #post(subject: string, text: string, again = true): Promise<boolean> {
		const action: Mine = { kind: 'comment', subject, rootSubject: this.subject, text };
		const reply = subject !== this.subject;
		const outcome = await this.#writer.act(
			action,
			(oauth, session) =>
				oauth.comment(session, {
					subject,
					text,
					rootSubject: reply ? this.subject : undefined
				}),
			{ again }
		);
		if (outcome === SIGN_IN) this.#askToSignIn(action);
		if (outcome === SIGN_IN || outcome === LEAVING) return false;
		const parent = this.#shown.get(subject);
		if (reply && !parent) {
			this.#announce('Reply posted.');
			return true;
		}
		const did = storage.get()!;
		const comment: Comment = {
			uri: outcome.done?.uri ?? '',
			did,
			handle: await handleOf(did),
			text,
			createdAt: new Date().toISOString()
		};
		const item = await this.#item(comment, parent ? parent.depth + 1 : 0, { fresh: true });
		(parent ? parent.replies : this.#list).append(item);
		parent?.composer?.remove();
		if (parent) parent.composer = undefined;
		this.#syncEmpty();
		this.#announce(reply ? 'Reply posted.' : 'Comment posted.');
		item.querySelector('article')!.focus();
		return true;
	}

	#confirmDelete(shown: Shown) {
		const keep = h('button', { type: 'button' }, 'Keep');
		keep.addEventListener('click', () => {
			this.#renderActions(shown);
			shown.actions.querySelector<HTMLElement>('[data-action="delete"]')!.focus();
		});
		shown.actions.replaceChildren(
			h('span', {}, 'Delete this comment?'),
			' ',
			h(
				'button',
				{ type: 'button', onclick: () => void this.#delete(shown.comment.uri) },
				'Delete'
			),
			' ',
			keep
		);
		keep.focus();
	}

	/** Deletes one of the reader's comments, and takes it off the page if it's on it yet. */
	async #delete(uri: string, again = true) {
		try {
			const outcome = await this.#writer.act(
				{ kind: 'delete', uri, rootSubject: this.subject },
				(oauth, session) => oauth.deleteComment(session, uri),
				{ again }
			);
			if (typeof outcome === 'object') this.#remove(uri);
		} catch {
			const shown = this.#shown.get(uri);
			if (!shown) {
				this.#announce("Couldn't delete your comment.");
				return;
			}
			this.#renderActions(shown);
			shown.actions.append(
				h('p', { class: 'standard-site-error', role: 'alert' }, "Couldn't delete your comment.")
			);
		}
	}

	#remove(uri: string) {
		this.#gone.add(uri);
		this.#announce('Comment deleted.');
		const shown = this.#shown.get(uri);
		if (!shown) return;
		// focus goes to the comment beside it, or the one it replied to, or (with
		// none left) the line that says so
		const near = shown.item.nextElementSibling ?? shown.item.previousElementSibling;
		const parent = shown.item.parentElement!.closest('.standard-site-comment');
		shown.item.remove();
		this.#shown.delete(uri);
		this.#syncEmpty();
		const article = (near ?? parent)?.querySelector<HTMLElement>(':scope > article');
		(article ?? this.#empty).focus();
	}

	#renderAccount() {
		const did = storage.get();
		this.#account.hidden = !did;
		if (!did) {
			this.#account.replaceChildren();
			return;
		}
		const name = h('b', {}, did);
		void handleOf(did).then((handle) => {
			if (handle) name.textContent = `@${handle}`;
		});
		this.#account.replaceChildren(
			'Signed in as ',
			name,
			' · ',
			h('button', { type: 'button', onclick: () => void this.#signOut() }, 'Sign out')
		);
	}

	#renderCompose() {
		if (!storage.get()) {
			this.#box = undefined;
			this.#composeError = undefined;
			this.#compose.replaceChildren(
				h(
					'button',
					{
						type: 'button',
						class: 'standard-site-sign-in-button',
						onclick: () =>
							this.#askToSignIn({
								kind: 'compose',
								subject: this.subject,
								rootSubject: this.subject
							})
					},
					'Sign in with your Atmosphere account to comment'
				)
			);
			return;
		}
		const { form, box, error } = composer({
			label: 'Your comment',
			action: 'Comment',
			post: (text) => this.#post(this.subject, text)
		});
		this.#box = box;
		this.#composeError = error;
		this.#compose.replaceChildren(form);
	}

	async #signOut() {
		await this.#writer.signOut().catch(() => {});
		this.#renderAccount();
		this.#renderCompose();
		for (const shown of this.#shown.values()) {
			shown.composer?.remove();
			shown.composer = undefined;
			this.#renderActions(shown);
		}
		this.#announce('Signed out.');
		this.#compose.querySelector('button')!.focus();
	}

	/** Finishes a comment, reply or delete the reader signed in to make, or opens the box they signed in to write in. */
	async #finishPending() {
		const action = pending.take(
			(candidate): candidate is Mine =>
				candidate.kind !== 'upvote' && candidate.rootSubject === this.subject
		);
		if (action?.kind === 'compose') {
			if (action.subject !== this.subject) {
				const shown = this.#shown.get(action.subject);
				if (shown) this.#reply(shown);
				else this.#resume = action.subject;
				return;
			}
			this.#box?.scrollIntoView({ block: 'center' });
			this.#box?.focus();
		} else if (action?.kind === 'comment') {
			await this.#post(action.subject, action.text, false).catch(() => {
				if (this.#composeError)
					this.#composeError.textContent = "Couldn't post your comment. Try again.";
				if (this.#box) this.#box.value = action.text;
			});
		} else if (action?.kind === 'delete') {
			await this.#delete(action.uri, false);
		}
	}

	#syncEmpty() {
		this.#empty.hidden = this.#list.children.length > 0;
	}

	#announce(message: string) {
		this.#status.textContent = message;
	}
}

const author = ({ handle, did }: Comment) => (handle ? `@${handle}` : did);
