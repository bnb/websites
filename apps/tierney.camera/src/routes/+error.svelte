<script lang="ts">
	import { page } from '$app/state';
	import { HANDLE } from '$lib/atproto';

	// A blown-out frame on a contact sheet: the film edge carries the status as
	// its frame number, and the frame itself is all light, nothing in it.
	const status = $derived(page.status);
	const notFound = $derived(status === 404);
</script>

<svelte:head>
	<title>{status} · tierney.camera</title>
</svelte:head>

<main class="error">
	<div class="sheet">
		<div class="edge mono" aria-hidden="true">
			<span>▸ {status}A</span><span>tierney.camera</span><span>{status}</span>
		</div>
		<div class="frame">
			<h1>{status}</h1>
		</div>
		<div class="edge mono" aria-hidden="true">
			<span>{status}</span><span>Overexposed</span><span>▸ {status}A</span>
		</div>
	</div>

	<div class="what mono">
		<p class="message">{page.error?.message ?? 'Something went sideways.'}</p>
		<p>
			{notFound
				? 'Nothing was shot here: there’s no page at this address.'
				: 'This frame didn’t develop: the server hit an error. Try again in a minute.'}
		</p>
		<p>
			<a href="/">Back to the photographs</a> or see them on
			<a href="https://grain.social/profile/{HANDLE}" target="_blank" rel="noopener">grain.social</a>.
		</p>
	</div>
</main>

<style>
	.error {
		display: grid;
		align-items: end;
		gap: 36px 48px;
		padding: clamp(40px, 10vh, 120px) var(--pad);
	}
	/* wide screens: the caption sits beside the strip, so both fit above the fold */
	@media (min-width: 1000px) {
		.error {
			grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr);
		}
	}

	/* a strip of black film: sprocket holes print light on a contact sheet */
	.sheet {
		padding: 0 clamp(12px, 2.4cqi, 28px);
		background: #000;
	}
	.edge {
		display: flex;
		justify-content: space-between;
		gap: 16px;
		padding: 26px 0 8px;
		background: repeating-linear-gradient(90deg, #d8d6cf 0 14px, transparent 14px 32px) 0 8px / 100%
			10px no-repeat;
		font-size: 11px;
		color: var(--accent);
	}
	.edge:last-child {
		padding: 8px 0 26px;
		background-position: 0 calc(100% - 8px);
	}

	/* overexposed: the light fills the frame and falls off only at its corners */
	.frame {
		display: grid;
		place-items: center;
		aspect-ratio: 3 / 2;
		container-type: inline-size;
		background: radial-gradient(
			ellipse at 50% 46%,
			#fff 0 38%,
			#f6f5f0 62%,
			#dcdad3 100%
		);
	}
	h1 {
		color: var(--accent-ink);
		font-family: var(--display);
		font-size: 26cqi;
		font-weight: var(--display-weight);
		font-stretch: var(--display-stretch);
		line-height: 0.8;
		letter-spacing: -0.02em;
	}

	.what {
		max-width: 52ch;
		color: var(--ink-dim);
		line-height: 1.8;
	}
	.what p + p {
		margin-top: 12px;
	}
	.message {
		color: var(--ink);
	}
	a {
		color: var(--ink);
		border-bottom: 1px solid var(--line-strong);
	}
	a:hover {
		color: var(--accent);
	}
</style>
