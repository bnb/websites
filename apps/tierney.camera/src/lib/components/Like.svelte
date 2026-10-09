<script lang="ts">
	import { likes as shared, type Likes } from '../likes';
	import type { LikeCounts } from '../types';
	import SignIn from './SignIn.svelte';

	let {
		subject,
		label,
		counts = {},
		large = false,
		store = shared
	}: {
		/** at:// uri of the gallery a like favorites */
		subject: string;
		/** what's being liked, for the button's name: "photograph 03" */
		label: string;
		/** how many people have liked each gallery, from the server */
		counts?: LikeCounts;
		/** the lightbox's bigger heart */
		large?: boolean;
		store?: Likes;
	} = $props();

	let asking = $state(false);
	// the pop plays when the reader likes it, not when their likes load
	let popped = $state(false);

	const liked = $derived(store.liked.has(subject));
	const count = $derived(store.count(subject, counts[subject]));
	const error = $derived(store.errors.get(subject));
	const name = $derived(`Like ${label}${count ? `, ${count} ${count === 1 ? 'like' : 'likes'}` : ''}`);

	async function onclick() {
		popped = !liked;
		if ((await store.toggle(subject)) === 'sign-in') asking = true;
	}
</script>

<span class="like" class:large data-like={subject}>
	<button type="button" class:pop={popped && liked} aria-pressed={liked} aria-label={name} {onclick}>
		<svg viewBox="0 0 24 24" aria-hidden="true">
			<path d="M12 20.4 4.6 13.2a4.7 4.7 0 0 1 6.7-6.7l.7.7.7-.7a4.7 4.7 0 0 1 6.7 6.7Z" />
		</svg>
		{#if count}<span class="count">{count}</span>{/if}
	</button>
	{#if error}<span class="error" role="alert">{error}</span>{/if}
	{#if asking}
		<SignIn onsubmit={(handle) => store.signIn(handle, subject)} onclose={() => (asking = false)} />
	{/if}
</span>

<style>
	/* sits in captions that ignore the pointer (the featured frame's) and set
	   mono uppercase, so it sets its own */
	.like {
		position: relative;
		display: inline-flex;
		pointer-events: auto;
	}

	button {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		/* a 24px target in a 12px caption, without pushing the line apart */
		min-width: 24px;
		min-height: 24px;
		margin: -6px 0;
		padding: 0 2px;
		border: 0;
		background: none;
		color: var(--ink-dim);
		font-family: var(--mono);
		font-size: 12px;
		letter-spacing: 0.06em;
		cursor: pointer;
		transition: color 0.2s var(--ease);
	}
	button:hover {
		color: var(--accent);
	}
	button[aria-pressed='true'] {
		color: var(--ink);
	}

	svg {
		flex: none;
		width: 14px;
		height: 14px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linejoin: round;
	}
	[aria-pressed='true'] svg {
		fill: var(--accent);
		stroke: var(--accent);
	}
	@media (prefers-reduced-motion: no-preference) {
		.pop svg {
			animation: pop 0.35s var(--ease);
		}
	}
	@keyframes pop {
		50% {
			transform: scale(1.3);
		}
	}

	.count {
		font-variant-numeric: tabular-nums;
	}

	.large button {
		gap: 10px;
		min-height: 44px;
		margin: 0;
	}
	.large svg {
		width: 18px;
		height: 18px;
	}

	/* over whatever's below, so nothing moves when it comes and goes */
	.error {
		position: absolute;
		top: calc(100% + 8px);
		right: 0;
		z-index: 2;
		padding: 6px 10px;
		border: 1px solid var(--line-strong);
		background: var(--bg);
		color: var(--ink);
		font-family: var(--mono);
		font-size: 11px;
		letter-spacing: 0.04em;
		text-transform: none;
		white-space: nowrap;
	}
</style>
