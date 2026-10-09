<script module lang="ts">
	export interface Row {
		/** zero-padded: the post's number on the index, its part in a series */
		n: string;
		/** HTML: titles can hold inline Markdown, like `code` */
		title: string;
		url: string;
		/** e.g. "ESM in Node.js 2/3", linking to the series */
		series?: { label: string; url: string };
		topic?: string;
		/** yyyy-mm-dd */
		date: string;
		year: string;
	}
</script>

<script lang="ts">
	let {
		rows,
		numberLabel = '№',
		topics = true,
		byYear = false
	}: {
		rows: Row[];
		numberLabel?: string;
		/** show the topic column (the index does, series pages don't) */
		topics?: boolean;
		/**
		 * split the rows by year, each under a giant year that heads its row
		 * group, and show each row's day and month instead of its year. For rows
		 * in date order (the index); series pages are in part order.
		 */
		byYear?: boolean;
	} = $props();

	// runs of rows from the same year (one run of everything when not split)
	const groups = $derived(
		rows.reduce<Row[][]>((runs, row) => {
			const last = runs.at(-1);
			if (last && (!byYear || last[0].year === row.year)) last.push(row);
			else runs.push([row]);
			return runs;
		}, [])
	);
	const columns = $derived(topics ? 4 : 3);
</script>

<table class="posts">
	<thead>
		<tr>
			<th scope="col">{numberLabel}</th><th scope="col">Title</th>{#if topics}<th
					scope="col"
					class="topic">Topic</th
				>{/if}<th scope="col" class="year">{byYear ? 'Date' : 'Year'}</th>
		</tr>
	</thead>
	{#each groups as group, i (group[0].url)}
		<tbody>
			{#if byYear}
				<tr class="year-break" class:newest={i === 0}>
					<th scope="rowgroup" colspan={columns}>
						<span class="numeral">{group[0].year}</span>
						<span class="count">{group.length} {group.length === 1 ? 'post' : 'posts'}</span>
					</th>
				</tr>
			{/if}
			{#each group as row (row.url)}
				<tr>
					<td class="n">{row.n}</td>
					<td>
						<a href={row.url} class="title">{@html row.title}</a>
						{#if row.series}
							<a href={row.series.url} class="series-tag">{row.series.label}</a>
						{/if}
					</td>
					{#if topics}<td class="topic"><span>{row.topic}</span></td>{/if}
					<td class="year">
						<time datetime={row.date}
							>{byYear ? `${row.date.slice(8)}.${row.date.slice(5, 7)}` : row.year}</time
						>
					</td>
				</tr>
			{/each}
		</tbody>
	{/each}
</table>

<style>
	.posts {
		width: 100%;
		border-collapse: collapse;
		margin: 1.5rem 0 3rem;
	}

	th {
		padding: 0.4rem 0.6rem;
		border-bottom: var(--rule) solid var(--ink);
		font-family: var(--mono);
		font-weight: 400;
		font-size: 0.72rem;
		letter-spacing: 0.06em;
		text-align: left;
		text-transform: uppercase;
	}

	td {
		padding: 0.95rem 0.6rem;
		border-bottom: 2px solid var(--ink);
		vertical-align: top;
	}

	.year-break th {
		padding: 2.25rem 0.6rem 0.5rem;
		border-bottom: var(--rule) solid var(--ink);
		text-transform: none;
		letter-spacing: normal;
	}

	tbody:first-of-type .year-break th {
		padding-top: 1rem;
	}

	.numeral {
		font-family: var(--display);
		font-size: clamp(4rem, 15cqi, 9rem);
		line-height: 0.8;
		letter-spacing: -0.03em;
		color: var(--bg);
		/* 0.035em: thick enough that axe judges the ink stroke, not the fill */
		-webkit-text-stroke: 0.035em var(--ink);
		paint-order: stroke fill;
	}

	.newest .numeral {
		color: var(--accent);
	}

	.count {
		display: inline-block;
		margin-left: 0.5rem;
		padding: 0.05rem 0.45rem;
		vertical-align: 0.4em;
		background: var(--highlight);
		font-size: 0.8rem;
		text-transform: uppercase;
		white-space: nowrap;
	}

	tbody tr:hover td {
		background: var(--accent);
	}

	td.n,
	td.year {
		padding-top: 1.15rem;
		font-family: var(--mono);
		font-size: 0.85rem;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.n {
		width: 3.5rem;
	}

	.year {
		width: 4.5rem;
		text-align: right;
	}

	.title {
		display: block;
		font-weight: 700;
		font-size: 1.2rem;
		line-height: 1.25;
		text-decoration: none;
	}

	.title:hover {
		background: none;
	}

	.title :global(code) {
		font-family: var(--mono);
		font-size: 0.85em;
		text-transform: none;
		background: var(--highlight);
		padding: 0 0.2em;
	}

	.series-tag {
		display: inline-block;
		margin-top: 0.4rem;
		padding: 0 0.35rem;
		background: var(--highlight);
		font-size: 0.8rem;
		font-weight: 500;
		text-decoration: none;
	}

	.series-tag:hover {
		background: var(--ink);
		color: var(--highlight);
	}

	.topic span {
		display: inline-block;
		margin-top: 0.15rem;
		padding: 0.05rem 0.4rem;
		border: 2px solid var(--ink);
		background: var(--bg);
		font-family: var(--mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		white-space: nowrap;
	}

	@media (max-width: 640px) {
		.topic {
			display: none;
		}

		.title {
			font-size: 1.05rem;
		}

		.n {
			width: 2.5rem;
		}
	}
</style>
