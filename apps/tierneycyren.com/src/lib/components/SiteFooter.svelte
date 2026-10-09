<script lang="ts">
	import { Fact, Facts, Signoff } from '@bnb/ui';
	import { BOOKING_EMAIL, NAME, SITE_NAME } from '../site';

	let { mixes = '' }: { /** e.g. "2 mixes · 1 hr 19 min" */ mixes?: string } = $props();

	const year = new Date().getFullYear();
</script>

<footer id="info" class="site-footer">
	{#if BOOKING_EMAIL || mixes}
		<div class="facts">
			<Facts>
				{#if BOOKING_EMAIL}
					<Fact term="Booking"><a class="out" href="mailto:{BOOKING_EMAIL}">{BOOKING_EMAIL}</a></Fact>
				{/if}
				{#if mixes}
					<Fact term="Mixes">{mixes}</Fact>
				{/if}
			</Facts>
		</div>
	{/if}

	<Signoff text={SITE_NAME.replace('.com', '')} decorative />

	<div class="fine mono">
		<span>© {year} {NAME}</span>
		<a href="#top">Back to top <span aria-hidden="true">↑</span></a>
	</div>
</footer>

<style>
	.site-footer {
		margin-top: clamp(64px, 8vw, 128px);
		border-top: 1px solid var(--line);
	}
	.facts {
		padding: 40px var(--pad) clamp(64px, 10vw, 160px);
	}
	.out {
		border-bottom: 1px solid var(--accent);
	}
	.fine {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 0 24px;
		padding: clamp(32px, 4vw, 56px) var(--pad) clamp(64px, 8vw, 128px);
		color: var(--ink-dim);
	}
	.fine a {
		padding: 14px 0;
	}
</style>
