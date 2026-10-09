<script lang="ts">
	let {
		lines,
		heading = true,
		href,
		mark = '',
		accent = 'mark',
		split = false
	}: {
		/** each string sets on its own line */
		lines: string[];
		/** an <h1>; otherwise the name is a plain link or paragraph */
		heading?: boolean;
		href?: string;
		/** trailing punctuation set in the accent colour, e.g. "." */
		mark?: string;
		/** what takes the accent colour: the mark, or the whole last line */
		accent?: 'mark' | 'last';
		/** set the last line flush right */
		split?: boolean;
	} = $props();
</script>

{#snippet name()}
	<!-- the spaces between lines keep the accessible name readable ("tierney cyren") -->
	{#each lines as line, i (i)}{#if i}{' '}{/if}<span
			class="line"
			class:last={i === lines.length - 1}
			class:accent={accent === 'last' && i === lines.length - 1}>{line}</span
		>{/each}{#if mark}<span class="mark">{mark}</span>{/if}
{/snippet}

{#if heading}
	<h1 class="big-name" class:split>
		{#if href}<a {href}>{@render name()}</a>{:else}{@render name()}{/if}
	</h1>
{:else if href}
	<a class="big-name" class:split {href}>{@render name()}</a>
{:else}
	<p class="big-name" class:split>{@render name()}</p>
{/if}

<style>
	/* Themes set the type with --name-*: size, leading and tracking. */
	.big-name {
		display: block;
		margin: var(--name-margin, 0);
		font-family: var(--display);
		font-size: var(--name-size, clamp(48px, 15.6cqi, 228px));
		font-weight: var(--display-weight);
		font-stretch: var(--display-stretch);
		line-height: var(--name-leading, 0.8);
		letter-spacing: var(--name-tracking, -0.02em);
		text-decoration: none;
		text-transform: uppercase;
	}
	a {
		color: inherit;
		text-decoration: none;
	}
	a:hover {
		background: none;
		color: inherit;
	}
	.line {
		display: block;
		white-space: var(--name-wrap, nowrap);
	}
	.last {
		display: inline;
	}
	.split .last {
		display: block;
		text-align: right;
	}
	.accent,
	.mark {
		color: var(--accent);
	}
</style>
