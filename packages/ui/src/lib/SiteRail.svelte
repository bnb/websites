<script module lang="ts">
	// Tierney's sites, in the rail's order. Each one's swatch is its own theme's
	// accent, the same on every site. `dev` is where each app's `npm run dev`
	// serves it, so the rail stays on the dev servers in development.
	const SITES = [
		{ id: 'bnb', domain: 'bnb.im', dev: 'http://127.0.0.1:5174' },
		{ id: 'camera', domain: 'tierney.camera', dev: 'http://127.0.0.1:5173' },
		{ id: 'dj', domain: 'tierneycyren.com', dev: 'http://localhost:5175' }
	] as const;

	export type SiteId = (typeof SITES)[number]['id'];

	const home = (site: (typeof SITES)[number]) =>
		import.meta.env.DEV ? `${site.dev}/` : `https://${site.domain}`;

	/** The newest thing on a site (see loadLatest in @bnb/atproto). */
	export interface LatestItem {
		kind: string;
		title?: string;
		image?: { src: string; alt: string; width?: number; height?: number };
		/** an ISO 8601 datetime */
		date: string;
	}

	export type Latest = Partial<Record<SiteId, LatestItem>>;

	// in UTC, so a post dated midnight reads as its own day everywhere
	const DAY = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' });
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		current,
		latest = {},
		children
	}: {
		/** the site this is: its link is filled and goes to this site's home */
		current: SiteId;
		/** each other site's newest item, for its preview and its link's description */
		latest?: Latest;
		/** the page beside the rail */
		children: Snippet;
	} = $props();

	const uid = $props.id();

	// Escape hides the previews until the pointer or focus moves on. It needs
	// JavaScript, so it only works on the sites that hydrate.
	let quiet = $state(false);
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape') quiet = true;
	}}
/>

<div class="site-rail">
	<nav class="rail" class:quiet aria-label="Tierney's sites">
		<span class="mark" aria-hidden="true">TC</span>
		<ul>
			{#each SITES as site (site.id)}
				{@const here = site.id === current}
				{@const item = here ? undefined : latest[site.id]}
				{@const day = item && DAY.format(new Date(item.date))}
				{@const label = item?.title ?? item?.image?.alt}
				<li class:here>
					<a
						href={here ? '/' : home(site)}
						data-site={site.id}
						aria-current={here ? 'true' : undefined}
						aria-describedby={item && `${uid}-${site.id}`}
						onpointerenter={() => (quiet = false)}
						onfocus={() => (quiet = false)}>{site.domain}</a
					>
					{#if !here}
						<!-- a preview of the site in its own look, beside the rail; the
						     link's description carries what it says -->
						<div class="poster" data-site={site.id} aria-hidden="true">
							<p class="name"><span>Tierney</span> <span class="last">Cyren</span></p>
							{#if item?.image}
								<!-- lazy, so it only downloads once the preview shows -->
								<img
									src={item.image.src}
									alt=""
									width={item.image.width}
									height={item.image.height}
									loading="lazy"
									decoding="async"
								/>
							{/if}
							{#if item}
								<p class="item">
									<span class="kind">Newest {item.kind}</span>
									{#if item.title}<span class="title">{item.title}</span>{/if}
									<time datetime={item.date}>{day}</time>
								</p>
							{/if}
						</div>
					{/if}
					{#if item}
						<span id="{uid}-{site.id}" hidden
							>Newest {item.kind}: {label ? `${label}, ` : ''}{day}</span
						>
					{/if}
				</li>
			{/each}
		</ul>
	</nav>
	<div class="page">{@render children()}</div>
</div>

<style>
	/* Phones: a strip across the top that scrolls sideways, current site first.
	   From 760px: a 72px rail down the left, pinned while the page scrolls.
	   Themes can set --rail-mark-bg, --rail-mark-ink and --rail-hover. The page
	   can read --rail-width to keep fixed elements clear of the rail. */
	.site-rail {
		--rail-width: 0px;
		display: flex;
		flex-direction: column;
	}

	/* the themes size their type in cqi, so it fills this column rather than
	   the whole window (cqi falls back to the viewport outside a container) */
	.page {
		flex: 1;
		min-width: 0;
		container-type: inline-size;
	}

	.rail {
		display: flex;
		border-bottom: var(--rule) solid var(--line);
		background: var(--bg);
		font-family: var(--mono);
	}

	.mark {
		display: grid;
		flex: none;
		place-items: center;
		width: 48px;
		border-right: var(--rule) solid var(--line);
		background: var(--rail-mark-bg, transparent);
		color: var(--rail-mark-ink, var(--ink));
		font-family: var(--display);
		font-size: 16px;
		font-weight: var(--display-weight);
		font-stretch: var(--display-stretch);
		letter-spacing: -0.02em;
	}

	ul {
		display: flex;
		flex: 1;
		margin: 0;
		padding: 0;
		list-style: none;
		overflow-x: auto;
		scrollbar-width: none;
		/* fades the last tab out when the strip is wider than the screen */
		mask-image: linear-gradient(to right, #000 calc(100% - 32px), transparent);
	}

	li {
		flex: none;
	}

	.here {
		order: -1;
	}

	a {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 48px;
		padding: 0 14px;
		border-right: var(--rule) solid var(--line);
		color: var(--ink-dim);
		font-size: 11px;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-decoration: none;
		text-transform: uppercase;
		white-space: nowrap;
	}

	a::before {
		content: '';
		flex: none;
		width: 8px;
		height: 8px;
		background: var(--swatch);
	}

	[data-site='bnb'] {
		--swatch: #ff0099;
	}
	[data-site='camera'] {
		--swatch: #d7ff3a;
	}
	[data-site='dj'] {
		--swatch: #00f0ff;
	}

	a:hover {
		background: var(--rail-hover, color-mix(in srgb, var(--ink) 10%, var(--bg)));
		color: var(--ink);
	}

	a:focus-visible {
		outline-offset: -4px;
		color: var(--ink);
	}

	.here a {
		background: var(--accent);
		color: var(--accent-ink);
	}

	.here a::before {
		outline: 2px solid var(--accent-ink);
		outline-offset: -2px;
	}

	.here a:focus-visible {
		outline-color: var(--accent-ink);
	}

	/* the previews only exist beside the rail */
	.poster {
		display: none;
	}

	@media (min-width: 760px) {
		.site-rail {
			--rail-width: 72px;
			flex-direction: row;
		}

		.rail {
			position: sticky;
			top: 0;
			flex: none;
			flex-direction: column;
			align-self: flex-start;
			width: var(--rail-width);
			height: 100vh;
			height: 100dvh;
			overflow-y: auto;
			scrollbar-width: none;
			border-bottom: 0;
			border-right: var(--rule) solid var(--line);
		}

		.mark {
			width: auto;
			height: 72px;
			border-right: 0;
			border-bottom: var(--rule) solid var(--line);
			font-size: 22px;
		}

		ul {
			flex-direction: column;
			justify-content: flex-end;
			overflow: visible;
			mask-image: none;
		}

		/* the same order on every site */
		.here {
			order: 0;
		}

		/* turned to read bottom to top, so border-bottom draws on top */
		a {
			writing-mode: vertical-rl;
			transform: rotate(180deg);
			width: 100%;
			min-height: 0;
			padding: 20px 0;
			border-right: 0;
			border-bottom: var(--rule) solid var(--line);
			font-size: 12px;
		}

		/* over the page, so the rail has to stack above it */
		.rail {
			z-index: 1;
		}

		/* Each other site's preview, beside the rail on hover (with a pointer
		   that can hover, so a tap still follows the link) or keyboard focus.
		   Fixed, so the rail's scrolling doesn't clip it; it keeps the top of
		   its static position (just under its link) and lifts itself so its
		   bottom sits level with the link. It never takes the pointer, and
		   it's set in the other site's own fonts and colours, so nothing here
		   reads this site's theme. Hovering one link hides a focused one's. */
		.rail:not(.quiet, :has(a:hover)) a:focus-visible + .poster {
			display: flex;
		}

		@media (hover: hover) {
			.rail:not(.quiet) a:hover + .poster {
				display: flex;
			}
		}

		.poster {
			position: fixed;
			left: calc(var(--rail-width) + 12px);
			flex-direction: column;
			gap: 14px;
			width: 280px;
			padding: 18px;
			translate: 0 calc(-100% - 12px);
			pointer-events: none;
			animation: poster-in 0.16s ease-out;
		}

		.poster p {
			margin: 0;
		}

		.name {
			display: flex;
			flex-direction: column;
			text-transform: uppercase;
		}

		.item {
			display: flex;
			flex-direction: column;
			gap: 4px;
			font-size: 11px;
			letter-spacing: 0.08em;
			text-transform: uppercase;
		}

		.title {
			display: -webkit-box;
			overflow: hidden;
			-webkit-box-orient: vertical;
			-webkit-line-clamp: 3;
			line-clamp: 3;
			font-size: 17px;
			letter-spacing: normal;
			line-height: 1.15;
			text-transform: none;
		}

		/* bnb.im, "Loud": white, black rules, a hard shadow, pink */
		.poster[data-site='bnb'] {
			gap: 0;
			padding: 0;
			border: 3px solid #0a0a0a;
			background: #fff;
			box-shadow: 6px 6px 0 #0a0a0a;
			color: #0a0a0a;
			font-family: 'DM Mono', ui-monospace, Menlo, Consolas, monospace;
		}

		[data-site='bnb'] .name {
			padding: 16px 16px 14px;
			font-family: 'Archivo Black', 'Arial Black', Impact, sans-serif;
			font-size: 50px;
			letter-spacing: -0.035em;
			line-height: 0.84;
		}

		[data-site='bnb'] .last::after {
			content: '.';
			color: #ff0099;
		}

		/* a still of the marquee, running off both edges */
		.poster[data-site='bnb']::after {
			content: 'Garbage ✶ Software and selected garbage ✶ Software and selected garbage';
			order: 1;
			overflow: hidden;
			padding: 5px 0;
			border-block: 3px solid #0a0a0a;
			background: #ff0099;
			font-family: 'Archivo Black', 'Arial Black', Impact, sans-serif;
			font-size: 14px;
			text-indent: -12px;
			text-transform: uppercase;
			white-space: nowrap;
		}

		[data-site='bnb'] .item {
			order: 2;
			padding: 12px 16px 14px;
			color: #555;
		}

		[data-site='bnb'] .title {
			color: #0a0a0a;
			font-family: 'Space Grotesk', system-ui, sans-serif;
			font-weight: 700;
		}

		/* tierney.camera, "Flyer": black, wide heavy type, acid green */
		.poster[data-site='camera'] {
			border: 1px solid rgba(243, 241, 236, 0.28);
			background: #0b0b0b;
			color: #f3f1ec;
			font-family: 'IBM Plex Mono', ui-monospace, Menlo, Consolas, monospace;
		}

		[data-site='camera'] .name,
		[data-site='camera'] .title {
			font-family: 'Archivo Variable', 'Arial Narrow', Arial, sans-serif;
			font-weight: 900;
			font-stretch: 125%;
		}

		[data-site='camera'] .name {
			font-size: 40px;
			letter-spacing: -0.02em;
			line-height: 0.8;
		}

		[data-site='camera'] .last {
			align-self: flex-end;
			color: #d7ff3a;
		}

		/* the photo itself, cropped so a tall one can't push the preview off
		   the top of the window */
		[data-site='camera'] img {
			display: block;
			width: 100%;
			height: auto;
			max-height: 200px;
			object-fit: cover;
			background: #1a1a1a;
		}

		[data-site='camera'] .item {
			padding-top: 12px;
			border-top: 1px solid rgba(243, 241, 236, 0.14);
			color: #9c9a95;
		}

		[data-site='camera'] .title {
			color: #f3f1ec;
			font-size: 18px;
			font-weight: 800;
			font-stretch: 100%;
			text-transform: uppercase;
		}

		/* tierneycyren.com, "Laser": UV black, condensed type, cyan, a few
		   beams of cyan and magenta */
		.poster[data-site='dj'] {
			border: 1px solid rgba(244, 239, 255, 0.3);
			background:
				linear-gradient(-14deg, transparent 49.6%, rgba(0, 240, 255, 0.55) 50%, transparent 50.4%),
				linear-gradient(9deg, transparent 49.7%, rgba(255, 61, 242, 0.45) 50%, transparent 50.3%),
				linear-gradient(-32deg, transparent 49.8%, rgba(0, 240, 255, 0.3) 50%, transparent 50.2%),
				#0c0716;
			color: #f4efff;
			font-family: 'IBM Plex Mono', ui-monospace, Menlo, Consolas, monospace;
		}

		[data-site='dj'] .name,
		[data-site='dj'] .title {
			font-family: 'Archivo Variable', 'Arial Narrow', Arial, sans-serif;
			font-weight: 900;
			font-stretch: 62%;
		}

		[data-site='dj'] .name {
			font-size: 74px;
			letter-spacing: -0.01em;
			line-height: 0.78;
		}

		[data-site='dj'] .last {
			color: #00f0ff;
		}

		[data-site='dj'] .item {
			color: #a99cc4;
		}

		[data-site='dj'] .kind {
			color: #ff3df2;
		}

		[data-site='dj'] .title {
			color: #f4efff;
			font-size: 26px;
			font-weight: 800;
			line-height: 0.95;
			text-transform: uppercase;
		}
	}

	@keyframes poster-in {
		from {
			opacity: 0;
			transform: translateX(-6px);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.poster {
			animation: none;
		}
	}
</style>
