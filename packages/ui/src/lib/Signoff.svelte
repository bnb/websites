<script lang="ts">
	let { text, decorative = false }: { text: string; decorative?: boolean } = $props();
</script>

<!-- a giant sign-off at the foot of the page; themes size it with --signoff-* -->
<p class="signoff" aria-hidden={decorative || undefined}>{text}</p>

<style>
	.signoff {
		margin: 0;
		overflow: hidden;
		padding: var(--signoff-pad, 0 var(--pad));
		color: var(--signoff-color, var(--accent));
		font-family: var(--display);
		font-size: var(--signoff-size, 7.6cqi);
		font-weight: var(--display-weight);
		font-stretch: var(--display-stretch);
		line-height: var(--signoff-leading, 0.8);
		letter-spacing: var(--signoff-tracking, -0.02em);
		text-align: center;
		text-transform: var(--signoff-case, uppercase);
		white-space: nowrap;
	}
</style>
