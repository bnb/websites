<script lang="ts">
	let {
		onsubmit,
		onclose
	}: {
		/** signs in with the handle typed (leaving the page); rejects if it can't */
		onsubmit: (handle: string) => Promise<void>;
		onclose: () => void;
	} = $props();

	const AT_SIGN = /^@/;
	const id = $props.id();

	let dialog = $state<HTMLDialogElement>();
	let handle = $state('');
	let busy = $state(false);
	let failed = $state(false);

	// a modal on top of everything, the lightbox included; focus starts in the field
	$effect(() => {
		dialog?.showModal();
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		failed = false;
		try {
			await onsubmit(handle.trim().replace(AT_SIGN, ''));
		} catch {
			failed = true;
			busy = false;
		}
	}
</script>

<dialog bind:this={dialog} class="sign-in" aria-labelledby="{id}-title" {onclose}>
	<form onsubmit={submit}>
		<h2 id="{id}-title">Sign in to like</h2>
		<label class="mono" for="{id}-handle">Your handle</label>
		<input
			id="{id}-handle"
			name="handle"
			type="text"
			placeholder="you.bsky.social"
			autocomplete="username"
			autocapitalize="none"
			spellcheck="false"
			required
			bind:value={handle}
		/>
		<p class="hint">Any Atmosphere account works, Bluesky included.</p>
		{#if failed}<p class="error" role="alert">Couldn't sign in with that handle.</p>{/if}
		<div class="actions">
			<button class="mono continue" type="submit" disabled={busy}>
				{busy ? 'Signing in…' : 'Continue'}
			</button>
			<button class="mono" type="button" onclick={() => dialog?.close()}>Cancel</button>
		</div>
	</form>
</dialog>

<style>
	/* it's opened from inside captions, which set their own type and ignore the pointer */
	.sign-in {
		width: min(420px, calc(100vw - 32px));
		margin: auto;
		padding: clamp(20px, 4vw, 32px);
		border: 1px solid var(--line-strong);
		background: var(--bg);
		color: var(--ink);
		font-family: var(--display);
		font-size: 16px;
		letter-spacing: normal;
		line-height: 1.5;
		text-align: left;
		text-transform: none;
		white-space: normal;
		pointer-events: auto;
	}
	.sign-in::backdrop {
		background: rgba(11, 11, 11, 0.82);
	}
	.sign-in[open] {
		animation: fade 0.25s var(--ease);
	}

	h2 {
		margin-bottom: 20px;
		font-size: clamp(24px, 3.4vw, 30px);
		font-weight: 900;
		font-stretch: 125%;
		line-height: 0.95;
		text-transform: uppercase;
	}
	label {
		display: block;
		margin-bottom: 8px;
		color: var(--ink-dim);
	}
	input {
		display: block;
		width: 100%;
		box-sizing: border-box;
		padding: 12px;
		border: 1px solid var(--line-strong);
		background: var(--bg-soft);
		color: var(--ink);
		/* 16px, so phones don't zoom in on focus */
		font: 16px var(--mono);
	}
	input::placeholder {
		color: var(--ink-faint);
	}
	input:focus-visible {
		outline-offset: 0;
		border-color: var(--accent);
	}
	.hint {
		margin-top: 10px;
		color: var(--ink-dim);
		font-size: 14px;
	}
	.error {
		margin-top: 10px;
		color: var(--accent);
		font-size: 14px;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin-top: 24px;
	}
	.actions button {
		min-height: 44px;
		padding: 0 20px;
		border: 1px solid var(--line-strong);
		background: none;
		cursor: pointer;
		transition:
			color 0.2s var(--ease),
			background 0.2s var(--ease),
			border-color 0.2s var(--ease);
	}
	.actions button:hover {
		border-color: var(--accent);
		color: var(--accent);
	}
	.actions .continue {
		border-color: var(--accent);
		background: var(--accent);
		color: var(--accent-ink);
	}
	.actions .continue:hover {
		background: var(--ink);
		border-color: var(--ink);
		color: var(--accent-ink);
	}
	.actions .continue:disabled {
		cursor: progress;
		opacity: 0.7;
	}
</style>
