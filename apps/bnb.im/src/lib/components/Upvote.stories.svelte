<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Upvote from './Upvote.svelte';

	// The button is standard.site's web component, which renders into the light
	// DOM (so the component's styles reach it). Here a story fills the element with the markup it renders, to show each state.
	const { Story } = defineMeta({
		title: 'bnb.im/Upvote',
		component: Upvote,
		parameters: { theme: 'bnb' },
		args: {
			subject: 'at://did:plc:uashgn65n5z7aqwk5cbuba5c/site.standard.document/3mwwg6sy4e32e'
		}
	});

	const button = (pressed: boolean, count: number) =>
		`<button type="button" aria-pressed="${pressed}" aria-label="Upvote, ${count} ${count === 1 ? 'upvote' : 'upvotes'}"><span class="standard-site-arrow" aria-hidden="true">▲</span> Upvote <span class="standard-site-count">${count}</span></button>`;

	const STATES: Record<string, string> = {
		counted: `${button(false, 12)}<p class="standard-site-error" role="alert"></p>`,
		upvoted: `${button(true, 13)}<p class="standard-site-error" role="alert"></p>`,
		error: `${button(false, 12)}<p class="standard-site-error" role="alert">Couldn't save your upvote.</p>`
	};

	const fill =
		(state: string) =>
		async ({ canvasElement }: { canvasElement: HTMLElement }) => {
			canvasElement.querySelector('standard-site-upvote')!.innerHTML = STATES[state];
		};
</script>

<Story name="With a count" play={fill('counted')} />

<Story name="Upvoted" play={fill('upvoted')} />

<Story name="Couldn't save" play={fill('error')} />
