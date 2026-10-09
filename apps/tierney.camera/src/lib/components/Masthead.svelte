<script lang="ts">
	import { BigName } from '@bnb/ui';
	import type { Profile } from '../types';
	import { nameLines, personName } from '../format';

	let { profile }: { profile: Profile | null } = $props();

	const bio = $derived((profile?.description ?? '').split('\n')[0].trim());
</script>

<section class="masthead">
	<BigName lines={nameLines(personName(profile))} accent="last" split />
	{#if bio}
		<p class="bio mono">{bio}</p>
	{/if}
</section>

<style>
	.masthead {
		display: grid;
		padding: clamp(28px, 3vw, 44px) var(--pad) 0;
		overflow: hidden;
	}

	.masthead > :global(.big-name) {
		grid-area: 1 / 1;
	}

	/* the bio shares the heading's grid cell, tucked into the empty corner
	   left of the last name */
	.bio {
		grid-area: 1 / 1;
		align-self: end;
		max-width: min(300px, 18vw);
		padding-bottom: calc(var(--name-size) * 0.06);
		font-size: 13px;
		line-height: 1.7;
		letter-spacing: 0.06em;
		color: var(--ink-dim);
	}

	@media (max-width: 900px) {
		.bio {
			grid-area: auto;
			max-width: 34ch;
			margin-top: 24px;
			padding-bottom: 0;
		}
	}
</style>
