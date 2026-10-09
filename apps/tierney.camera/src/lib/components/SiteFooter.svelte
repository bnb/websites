<script lang="ts">
	import { Fact, Facts, Signoff } from '@bnb/ui';
	import { BASED_IN, SITE_NAME } from '../site';
	import FStop from './FStop.svelte';

	let { name, kit = [] }: { name: string; kit?: string[] } = $props();

	const year = new Date().getFullYear();
</script>

<footer id="info" class="site-footer">
	<div class="facts">
		<Facts>
			<Fact term="Based">{BASED_IN}</Fact>
			{#if kit.length}
				<Fact term="Kit">
					{#each kit as item, i (item)}{#if i}<br />{/if}<FStop text={item} />{/each}
				</Fact>
			{/if}
		</Facts>
	</div>

	<!-- a long, quiet runway down to the sign-off -->
	<div class="runway" aria-hidden="true"><span></span></div>

	<Signoff text={SITE_NAME} decorative />

	<div class="fine mono">
		<span>© {year} {name}</span>
		<a href="#top">Back to top <span aria-hidden="true">↑</span></a>
	</div>
</footer>

<style>
	.site-footer {
		margin-top: clamp(64px, 8vw, 128px);
		border-top: 1px solid var(--line);
	}

	.facts {
		padding: 40px var(--pad) 0;
	}
	.runway {
		display: flex;
		justify-content: center;
		height: clamp(260px, 38vw, 600px);
		margin-top: clamp(48px, 6vw, 96px);
	}
	.runway span {
		width: 1px;
		height: 100%;
		background: linear-gradient(to bottom, transparent, var(--accent));
	}

	.fine {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 0 24px;
		padding: clamp(40px, 5vw, 72px) var(--pad) clamp(120px, 16vw, 260px);
		font-size: 12px;
		color: var(--ink-dim);
	}
	.fine a {
		padding: 14px 0;
	}
</style>
