<script lang="ts">
	import type { Snippet } from 'svelte';

	let { term, children }: { term: string; children: Snippet } = $props();
</script>

<div>
	<dt>{term}</dt>
	<dd>{@render children()}</dd>
</div>
