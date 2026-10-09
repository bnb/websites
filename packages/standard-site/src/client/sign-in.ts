import { AT_SIGN } from './shared';

let opened = 0;

/**
 * Asks for the reader's handle in a modal dialog (on the body, styled by the
 * site's global CSS), then hands it to `signIn`, which leaves the page. If that
 * fails, the dialog says so and they can try again. Focus goes back where it
 * was when they close it.
 */
export function askToSignIn(signIn: (handle: string) => Promise<void>) {
	const id = `standard-site-sign-in-${++opened}`;
	const dialog = document.createElement('dialog');
	dialog.className = 'standard-site-dialog';
	dialog.setAttribute('aria-labelledby', `${id}-title`);
	dialog.innerHTML =
		'<form class="standard-site-sign-in">' +
		`<h2 id="${id}-title">Sign in</h2>` +
		`<label for="${id}-handle">Your handle</label>` +
		`<input id="${id}-handle" name="handle" type="text" placeholder="you.bsky.social" autocomplete="username" autocapitalize="none" spellcheck="false" required>` +
		'<p class="standard-site-hint">Any Atmosphere account works, Bluesky included.</p>' +
		'<p class="standard-site-error" role="alert"></p>' +
		'<div class="standard-site-actions">' +
		'<button type="submit">Continue</button>' +
		'<button type="button" data-action="cancel">Cancel</button>' +
		'</div>' +
		'</form>';
	const form = dialog.querySelector('form')!;
	const input = form.elements.namedItem('handle') as HTMLInputElement;
	const submit = form.querySelector<HTMLButtonElement>('[type="submit"]')!;
	const error = form.querySelector('[role="alert"]')!;

	form.addEventListener('submit', async (event) => {
		event.preventDefault();
		submit.disabled = true;
		submit.textContent = 'Signing in…';
		error.textContent = '';
		try {
			await signIn(input.value.trim().replace(AT_SIGN, ''));
		} catch {
			error.textContent = "Couldn't sign in with that handle.";
			submit.disabled = false;
			submit.textContent = 'Continue';
			input.focus();
		}
	});
	form.querySelector('[data-action="cancel"]')!.addEventListener('click', () => dialog.close());
	dialog.addEventListener('close', () => dialog.remove());

	document.body.append(dialog);
	dialog.showModal();
	return dialog;
}
