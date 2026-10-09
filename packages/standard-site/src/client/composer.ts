import { h } from './dom';
import { counter, problem } from './text';

let made = 0;

export interface ComposerOptions {
	/** the visible label: "Your comment", "Your reply to @handle" */
	label: string;
	/** the button: "Comment" or "Reply" */
	action: string;
	/** posts the text: true once posted, false if it wasn't (signing in, say); throws if it failed */
	post: (text: string) => Promise<boolean>;
	/** a reply's composer can be closed */
	cancel?: () => void;
}

/**
 * A box to write a comment in, checked against the lexicon's limits before it
 * posts, with a count once it's near them.
 */
export function composer({ label, action, post, cancel }: ComposerOptions) {
	const id = `standard-site-composer-${++made}`;
	const box = h('textarea', {
		id,
		name: 'text',
		rows: '4',
		required: true,
		'aria-describedby': `${id}-count`
	});
	const count = h('p', { id: `${id}-count`, class: 'standard-site-counter' });
	const error = h('p', { class: 'standard-site-error', role: 'alert' });
	const submit = h('button', { type: 'submit' }, action);
	const form = h(
		'form',
		{ class: 'standard-site-composer' },
		h('label', { for: id }, label),
		box,
		count,
		error,
		h(
			'div',
			{ class: 'standard-site-actions' },
			submit,
			cancel && h('button', { type: 'button', onclick: cancel }, 'Cancel')
		)
	);

	box.addEventListener('input', () => {
		count.textContent = counter(box.value);
	});
	form.addEventListener('submit', async (event) => {
		event.preventDefault();
		const wrong = problem(box.value);
		error.textContent = wrong ?? '';
		if (wrong) {
			box.focus();
			return;
		}
		submit.disabled = true;
		const posted = await post(box.value).catch(() => {
			error.textContent = "Couldn't post that. Try again.";
			return false;
		});
		submit.disabled = false;
		if (!posted) return;
		box.value = '';
		count.textContent = '';
	});

	return { form, box, error };
}
