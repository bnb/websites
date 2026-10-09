<script lang="ts">
	import { page } from '$app/state';
	import Record from '$lib/components/Record.svelte';
	import { NAME } from '$lib/site';

	const message = $derived(
		page.status === 404
			? 'Track not found: there’s no page at this address.'
			: (page.error?.message ?? 'Something went sideways.')
	);
</script>

<svelte:head>
	<title>{page.status} · {NAME}</title>
</svelte:head>

<!-- the needle lifts off the record: the music stopped here -->
<main class="error">
	<div class="deck"><Record arm="lift" /></div>
	<div class="copy">
		<span class="kicker mono"><span>Needle up</span></span>
		<h1>{page.status}</h1>
		<p class="mono">
			{message}
			<br /><br />
			<a href="/">Back to the mixes</a>
		</p>
	</div>
</main>

<style>
	.error {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(160px, 380px);
		align-items: center;
		gap: clamp(32px, 6vw, 96px);
		padding: clamp(64px, 16vh, 180px) var(--pad);
	}

	.deck {
		order: 1;
		max-width: 380px;
	}

	.copy {
		display: grid;
		gap: clamp(20px, 3vw, 36px);
		justify-items: start;
	}
	.kicker span {
		display: inline-block;
		padding: 4px 10px;
		background: var(--highlight);
		color: var(--highlight-ink);
		font-weight: 500;
	}
	h1 {
		color: var(--accent);
		font-size: clamp(96px, 24cqi, 320px);
		font-weight: 900;
		font-stretch: 62%;
		line-height: 0.8;
		letter-spacing: -0.02em;
	}
	p {
		max-width: 52ch;
		color: var(--ink-dim);
		line-height: 1.8;
	}
	a {
		color: var(--ink);
		border-bottom: 1px solid var(--line-strong);
	}

	@media (max-width: 640px) {
		.error {
			grid-template-columns: 1fr;
		}
		.deck {
			order: 0;
			width: min(60%, 240px);
		}
	}
</style>
