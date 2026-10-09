<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Comments from './Comments.svelte';

	// The list is standard.site's web component, which renders into the light
	// DOM (so the component's styles reach it). Here a story fills the element with the markup it renders, to show each state.
	// "Loading" is the component as the page is served: the ghost lines.
	const { Story } = defineMeta({
		title: 'bnb.im/Comments',
		component: Comments,
		parameters: { theme: 'bnb' },
		args: {
			subject: 'at://did:plc:uashgn65n5z7aqwk5cbuba5c/site.standard.document/3mwwg6sy4e32e'
		}
	});

	let made = 0;
	const comment = (author: string, date: string, body: string, actions: string, replies = '') => {
		const id = `story-comment-${++made}`;
		return `<li class="standard-site-comment"><article tabindex="-1" aria-labelledby="${id}"><header id="${id}"><span class="standard-site-author">${author}</span> <time datetime="2026-10-09">${date}</time></header><div class="standard-site-body">${body}</div><div class="standard-site-actions">${actions}</div></article><div class="standard-site-replies"><ol class="standard-site-thread">${replies}</ol></div></li>`;
	};
	const reply = (author: string) =>
		`<button type="button" data-action="reply" aria-label="Reply to ${author}">Reply</button>`;
	const status = '<p class="standard-site-status" role="status"></p>';
	const signIn =
		'<div class="standard-site-compose"><button type="button" class="standard-site-sign-in-button">Sign in with your Atmosphere account to comment</button></div>';
	const composer = (text: string, count: string) =>
		`<div class="standard-site-compose"><form class="standard-site-composer"><label for="story-box">Your comment</label><textarea id="story-box" rows="4" aria-describedby="story-count">${text}</textarea><p id="story-count" class="standard-site-counter">${count}</p><p class="standard-site-error" role="alert"></p><div class="standard-site-actions"><button type="submit">Comment</button></div></form></div>`;
	const thread = (items: string) =>
		`<div class="standard-site-replies"><ol class="standard-site-thread">${items}</ol></div>`;

	const STATES: Record<string, string> = {
		thread:
			thread(
				comment(
					'@alice.example',
					'Oct 9, 2026',
					'<p>This is the <strong>clearest</strong> explainer of the Atmosphere I’ve read. Sending it to my <a href="https://example.com" rel="nofollow ugc noopener noreferrer" target="_blank">group chat</a>.</p>',
					reply('@alice.example'),
					comment('@bob.example', 'Oct 9, 2026', '<p>Same. The email analogy finally landed for me.</p>', reply('@bob.example'))
				) +
					comment('did:plc:3abc', 'Oct 10, 2026', '<p>Does this work with a self-hosted PDS?</p>', reply('did:plc:3abc'))
			) +
			'<p class="standard-site-empty" tabindex="-1" hidden>No comments yet.</p>' +
			signIn +
			status,
		empty:
			thread('') + '<p class="standard-site-empty" tabindex="-1">No comments yet.</p>' + signIn + status,
		signedIn:
			'<p class="standard-site-account">Signed in as <b>@reader.example</b> · <button type="button">Sign out</button></p>' +
			thread(
				comment(
					'@reader.example',
					'Oct 9, 2026',
					'<p>First!</p>',
					`${reply('@reader.example')}<span>Delete this comment?</span> <button type="button">Delete</button> <button type="button">Keep</button>`
				)
			) +
			composer('a'.repeat(4600), '4,600 / 5,000') +
			status,
		error:
			'<p class="standard-site-error"><span>Couldn\'t load the comments.</span> <button type="button">Try again</button></p>'
	};

	const fill =
		(state: string) =>
		async ({ canvasElement }: { canvasElement: HTMLElement }) => {
			canvasElement.querySelector('standard-site-comments')!.innerHTML = STATES[state];
		};
</script>

<Story name="Loading" />

<Story name="A thread" play={fill('thread')} />

<Story name="No comments" play={fill('empty')} />

<Story name="Signed in" play={fill('signedIn')} />

<Story name="Couldn't load" play={fill('error')} />
