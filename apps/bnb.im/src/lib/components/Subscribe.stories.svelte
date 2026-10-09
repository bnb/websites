<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Subscribe from './Subscribe.svelte';

	// The button is standard.site's web component, which renders into the light
	// DOM (so the box's styles reach it). The site serves its script; here a
	// story fills the element with the markup it renders, to show each state.
	const { Story } = defineMeta({
		title: 'bnb.im/Subscribe',
		component: Subscribe,
		parameters: { theme: 'bnb' },
		args: {
			publication: 'at://did:plc:uashgn65n5z7aqwk5cbuba5c/site.standard.publication/3mtxb2uyta22l',
			script: 'data:text/javascript,'
		}
	});

	const STATES: Record<string, string> = {
		idle: '<button type="button" data-action="subscribe">Subscribe</button>',
		form: `<form class="standard-site-subscribe-form">
			<label for="handle">Your Atmosphere handle</label>
			<input id="handle" value="bnb.im">
			<button type="submit" data-action="subscribe">Continue</button>
			<button type="button" data-action="cancel">Cancel</button>
		</form>
		<p class="standard-site-subscribe-hint">You'll sign in on your own server.</p>`,
		subscribed: `<p class="standard-site-subscribe-status">You're subscribed.</p>
			<button type="button" data-action="unsubscribe">Unsubscribe</button>`,
		error: `<button type="button" data-action="subscribe">Subscribe</button>
			<p class="standard-site-subscribe-error">That handle didn't resolve.</p>`
	};

	const fill =
		(state: string) =>
		async ({ canvasElement }: { canvasElement: HTMLElement }) => {
			const element = canvasElement.querySelector('standard-site-subscribe')!;
			element.setAttribute('data-state', state === 'error' ? 'idle' : state);
			element.innerHTML = STATES[state];
		};
</script>

<Story name="Idle" play={fill('idle')} />

<Story name="Entering a handle" play={fill('form')} />

<Story name="Subscribed" play={fill('subscribed')} />

<Story name="Error" play={fill('error')} />
