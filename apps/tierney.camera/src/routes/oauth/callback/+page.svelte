<script lang="ts">
	import { onMount } from 'svelte';
	import { likes } from '$lib/likes';

	// Where readers land after signing in to like a photograph: finish signing
	// in, then straight back to the photographs, where their like is made.
	let failed = $state(false);

	onMount(async () => {
		try {
			window.location.replace(await likes.finish());
		} catch {
			failed = true;
		}
	});
</script>

<svelte:head>
	<title>Signing in · tierney.camera</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="callback">
	<h1>Signing in</h1>
	<p class="mono" role="status">
		{failed ? "Couldn't finish signing in." : 'Signing you in…'}
	</p>
	{#if failed}
		<a class="mono" href="/">Back to the photographs</a>
	{/if}
</main>

<style>
	.callback {
		display: flex;
		flex-direction: column;
		gap: 20px;
		align-items: flex-start;
		min-height: 60vh;
		padding: clamp(48px, 12vh, 140px) var(--pad);
	}
	h1 {
		font-size: clamp(36px, 5vw, 76px);
		font-weight: 900;
		font-stretch: 125%;
		line-height: 0.9;
		letter-spacing: -0.01em;
		text-transform: uppercase;
	}
	p {
		color: var(--ink-dim);
	}
	a {
		color: var(--accent);
		border-bottom: 1px solid currentColor;
	}
</style>
