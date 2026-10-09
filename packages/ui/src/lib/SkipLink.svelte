<script lang="ts">
	let { href, label }: { href: string; label: string } = $props();
</script>

<!-- the first stop in the tab order; hidden until it has keyboard focus -->
<a class="skip" {href}>{label}</a>

<style>
	.skip {
		position: absolute;
		top: 8px;
		left: 8px;
		z-index: 2000;
		padding: 12px 16px;
		background: var(--accent);
		color: var(--accent-ink);
		font-family: var(--mono);
		font-size: 12px;
		letter-spacing: 0.08em;
		text-decoration: none;
		text-transform: uppercase;
		transform: translateY(-200%);
	}
	.skip:focus-visible {
		transform: none;
	}
</style>
