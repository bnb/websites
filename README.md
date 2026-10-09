# websites

Tierney Cyren's three websites, built on one stack with one design system:

| Site | What it is | Data | Hosting |
| ---- | ---------- | ---- | ------- |
| [bnb.im](apps/bnb.im) | The blog: open source, JavaScript, standards, the AT Protocol | Markdown in `posts/`, published to the AT Protocol as standard.site records | Static, GitHub Pages |
| [tierney.camera](apps/tierney.camera) | Photography portfolio | grain.social records, read live from the PDS | Node, Railway |
| [tierneycyren.com](apps/tierneycyren.com) | DJ site | plyr.fm records (mixes), read live from the PDS | Node |

All three are SvelteKit 2 + Svelte 5 + TypeScript, and they share their components, theme tokens, AT
Protocol client and SvelteKit plumbing. The feature lists, which double as the parity checklists for the
move from Eleventy and the old standalone repository, are in [`docs/features`](docs/features).

## Layout

```
apps/
  bnb.im/            the blog (adapter-static, no SvelteKit client-side JavaScript)
  tierney.camera/    the portfolio (adapter-node)
  tierneycyren.com/  the DJ site (adapter-node)
  styleguide/        Storybook: foundations, shared components and every site's components
packages/
  ui/                @bnb/ui: theme tokens (themes/*.css), base.css and shared Svelte components
  atproto/           @bnb/atproto: PDS resolution, paginated record reads, CDN and blob URLs, AT Tags
  atmosphere/        @bnb/atmosphere: the readers' browser client (OAuth sign-in, writes to their repo,
                     Constellation and Slingshot reads)
  kit/               @bnb/kit: security headers, the hash-based CSP, a stale-while-revalidate cache,
                     request timeouts and a health check
  standard-site/     @bnb/standard-site: standard.site without a site generator: Markdown → leaflet
                     records, syncing them to the PDS, and the subscribe, upvote and comments elements
  testing/           @bnb/testing: the axe check every end-to-end suite runs, the Lighthouse budget
docs/features/       what each site does
```

Packages are consumed as source: Vite compiles them along with each app. The one build step is
`@bnb/standard-site`'s browser bundle (the subscribe button, upvotes and comments), which bnb.im's `dev` and
`build` run first.

## The design system

The three sites started as three Claude-made designs with a lot in common: a huge name, a scrolling band,
mono labels, numbered lists and a giant sign-off. Those are now shared components in `@bnb/ui`, and each
site dresses them with a theme:

| Theme | Site | Look |
| ----- | ---- | ---- |
| `bnb` ("Loud") | bnb.im | white, 3px black rules, hard shadows, hot pink fills, Archivo Black / Space Grotesk / DM Mono |
| `camera` ("Flyer") | tierney.camera | black, wide Archivo, acid green, IBM Plex Mono captions |
| `dj` ("Laser") | tierneycyren.com | UV black, condensed Archivo, cyan and magenta |

A site picks its theme with `<html data-theme="…">` and imports `@bnb/ui/themes/<theme>.css`. The themes
share token names (`--bg`, `--ink`, `--accent`, `--display`, `--mono`, …) plus component tokens
(`--marquee-*`, `--name-*`, `--signoff-*`, `--rail-*`), so every component works in all three. Sizes that
scale with the width are in `cqi`, so they fill the page column beside the rail.

Shared components: `SiteRail` (the nav between the three sites that every page sits in: a strip on top on
phones, a pinned rail down the left from 760px, where hovering or focusing another site's link shows a
preview of it in its own look with its newest post, photo or mix), `BigName`, `Marquee` (pausable with or without
JavaScript), `Facts`/`Fact`, `Signoff`, `SkipLink`, `Seo` and `HeadTags` (AT Tags and
standard.site link tags).

### Styleguide

```sh
npm run storybook        # http://localhost:6006
npm run build-storybook  # static build in apps/styleguide/storybook-static
```

The toolbar's Theme menu dresses the shared components as any site; each site's own stories are pinned
to its theme, with that site's global stylesheet loaded. Every story is also an accessibility test:
`npm run test:storybook` renders each one in Chromium and fails on any axe violation.

## Getting started

```sh
npm install
npx playwright install chromium   # once, for browser tests, e2e and Lighthouse

npm run dev          # all three sites and Storybook at once
npm run dev:bnb      # bnb.im on http://127.0.0.1:5174
npm run dev:camera   # tierney.camera on http://127.0.0.1:5173
npm run dev:dj       # tierneycyren.com on http://localhost:5175
```

In development the site rail links to these dev servers instead of the live sites, so if you change a
port, change it in `SiteRail.svelte` too. Each site's layout reads the rail's newest items from the PDS
(`loadLatest` in `@bnb/atproto`): tierney.camera and tierneycyren.com every five minutes, bnb.im once a
build, so its rail is as fresh as its last deploy.

Node 22 or newer (`.tool-versions` pins 24).

## Scripts

Run from the root; each runs across every workspace that has it.

```sh
npm run lint            # oxlint
npm run lint:e18e       # e18e ecosystem-performance rules (ESLint)
npm run lint:all        # both
npm run format          # oxfmt (format:check to verify)
npm run knip            # unused files, dependencies and exports
npm run check           # svelte-check / tsc

npm run test:unit       # Vitest: Node unit tests and real-browser component tests
npm run test:coverage   # the same, failing below each workspace's coverage thresholds
npm run test:storybook  # every story, checked with axe
npm run test:e2e        # Playwright against each site's production build
npm run test:a11y       # stories + each site's axe e2e suite
npm run test            # unit + stories + e2e

npm run build           # every app
npm run lighthouse      # Lighthouse CI for each site (a11y and SEO must be 100)
npm run verify          # lint, format, knip, types, coverage, stories, build
```

Or in one workspace: `npm run test:e2e -w apps/bnb.im`.

## Tooling

- [SvelteKit](https://svelte.dev/) with Svelte 5 (runes) and TypeScript; [Vite](https://vite.dev/)
- [oxlint](https://oxc.rs/) and [oxfmt](https://oxc.rs/docs/guide/usage/formatter), configured once at
  the root. Library code (`src/lib`, `packages/*/src`) imports relatively, never through `$lib`, so the
  styleguide can render it outside its app; oxlint enforces that.
- [@e18e/eslint-plugin](https://e18e.dev/) for ecosystem-performance rules
- [knip](https://knip.dev/) for unused files, dependencies and exports, per workspace
- [Vitest](https://vitest.dev/) with v8 coverage and thresholds per workspace; browser-mode component tests
  in Chromium via Playwright
- [Playwright](https://playwright.dev/) end-to-end tests and [axe-core](https://github.com/dequelabs/axe-core)
  (WCAG 2.2 AA + best practices) on every page, on a laptop and a phone
- [Storybook](https://storybook.js.org/) as the styleguide, every story an axe test
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci), run through `npx`
- [Fontsource](https://fontsource.org/) for self-hosted fonts on every site

`.github/workflows/ci.yml` runs all of it on pushes and pull requests;
`.github/workflows/deploy-bnb.im.yml` publishes bnb.im to GitHub Pages.
