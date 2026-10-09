# tierney.camera

A photography portfolio for tierney cyren ([@bnb.im](https://grain.social/profile/bnb.im)), read live from
the AT Protocol. It shows the same [grain.social](https://grain.social) records that back the app, and
nothing is uploaded to the site itself.

The design ("Flyer") is a black club-flyer layout: the name set huge in wide Archivo, one featured
photograph, a scrolling ticker of places and kit, justified rows of photographs with
mono EXIF captions, and a long quiet runway down to the wordmark.

## How it works

On each request the server resolves the account's PDS from its DID document (migration-safe), then reads
five grain.social collections and joins them into render-ready photographs:

| Collection                     | Used for                                  |
| ------------------------------ | ----------------------------------------- |
| `social.grain.photo`           | the image blob + aspect ratio             |
| `social.grain.photo.exif`      | camera, lens, focal length, ƒ, shutter, ISO |
| `social.grain.gallery`         | location (e.g. _Bushwick, New York_)      |
| `social.grain.gallery.item`    | which photo belongs to which gallery      |
| `social.grain.actor.profile`   | display name + bio for the masthead       |

EXIF rationals are stored scaled by 1,000,000 (ISO 12800 → `12800000000`); decoding lives in
[`src/lib/exif.ts`](src/lib/exif.ts). The join is a pure function in
[`src/lib/atproto.ts`](src/lib/atproto.ts) (`assemblePhotos`), the flyer grid is a pure function in
[`src/lib/layout.ts`](src/lib/layout.ts) (`flyerLayout`), and caption and ticker text lives in
[`src/lib/format.ts`](src/lib/format.ts). All of them are unit-tested without a network.

The grid is a set of justified rows. Every photograph keeps its own aspect ratio, every frame in a row has
the same height, and every row fills the width. Once the grid knows its width, `justify` (in
[`src/lib/layout.ts`](src/lib/layout.ts)) breaks the photographs into rows with a small dynamic program
that keeps each row's height as close as it can to a target. A `ResizeObserver` reruns it as the window is
resized: three or four to a row on a wide screen, two or three on a laptop, two on a tablet and one on a
phone. The CSS sizes each frame from its share of its row, so the rows stay exact between observations.

The server-rendered HTML (and the page without JS) uses flexbox alone: each photograph's flex basis and
growth are proportional to its aspect ratio, and the browser packs as many into a row as fit.

After every six photographs the next landscape runs full width as a feature frame, a letterbox that widens
with the screen, as long as at least three photographs follow it. Captions shorten when a frame is narrow
(a container query). The featured photograph is set by `FEATURED_CID` in
[`src/lib/site.ts`](src/lib/site.ts); if that photo is ever deleted, the newest landscape photograph takes
its place.

Images load as atproto CDN thumbnails (fast and reliable). `sharpen` (from `@bnb/ui`) then swaps in the full-size render only where the screen needs the pixels, and only after it has loaded, because
the CDN's full-size preset can time out for photos it hasn't rendered yet. Any failed image falls back to
the raw blob straight from the PDS, including failures that happen before hydration.

The lightbox has a light meter: each photograph's scene brightness as EV at ISO 100, worked out from its
aperture, shutter and ISO (`exposureValue` in [`src/lib/exif.ts`](src/lib/exif.ts)) and shown as a needle on
an arc from EV −2 to 16. Under every caption, and in the lightbox, a thin strip shows the photograph's
dominant colours, each as wide as its share of the frame. The CDN sends no CORS headers, so the colours are
read on the server: [`src/lib/server/palette.ts`](src/lib/server/palette.ts) fetches each thumbnail once,
shrinks it with `sharp` and hands the pixels to `dominantColours` ([`src/lib/palette.ts`](src/lib/palette.ts)).
Blobs are content-addressed, so palettes are kept by CID for the life of the process. A page never waits for
them: it gets the ones that are ready, the rest are read in the background (four at a time) and show on a
later render.

## Likes

Every photograph with a gallery has a heart, and a like is grain.social's own: a `social.grain.favorite`
record in the reader's repo whose subject is the photo's gallery (grain favorites galleries, and every photo
here has one to itself), so likes here and on grain.social are the same likes.

The counts come from [Constellation](https://constellation.microcosm.blue), microcosm's backlink index:
the server asks it how many favorites point at each gallery, once per gallery every five minutes, in a cache
next to the portfolio's ([`src/lib/server/likes.ts`](src/lib/server/likes.ts)). A gallery it can't count
shows no number, and counts never hold up or fail the page.

Liking signs the reader in with their Atmosphere account (ATProto OAuth in the browser, from
[`@bnb/atmosphere`](../../packages/atmosphere)), asking only to create and delete their favorites. The
client lives in [`src/lib/likes.ts`](src/lib/likes.ts): a new reader types their handle in a small dialog
and comes back through `/oauth/callback/`, where their like is made; a returning reader's session restores
when the page loads and fills in their hearts. Likes are optimistic: the heart changes at once and changes
back, with a short message, if the write fails. Liking checks the reader's repo first so it never doubles up,
and unliking removes every favorite of that gallery. The OAuth client and the repo writes load only for a
returning reader or a click.

The OAuth client is described at `/oauth-client-metadata.json`. In local dev a loopback client stands in
for it, and the callback has to land on 127.0.0.1, so the dev server and preview listen there and a page
opened on localhost moves to 127.0.0.1 before signing in.

`/og.png` is the share card the home page gives Open Graph and X: the name and the featured photograph,
drawn with satori and resvg ([`src/lib/server/card.ts`](src/lib/server/card.ts)) and kept in memory until
what's on it changes. If the PDS or the CDN is down, a card in type alone stands in for five minutes.

## Production notes

### Caching

The server keeps the portfolio in memory for 5 minutes and refreshes it in the background
(stale-while-revalidate, `swrCache` from `@bnb/kit`, used in [`src/lib/server/portfolio.ts`](src/lib/server/portfolio.ts)). During a PDS outage it
keeps serving the last good copy. Responses carry `s-maxage=300, stale-while-revalidate=86400` for a CDN.
Every AT Protocol request times out after 8 seconds, so a hung PDS can't stall a page. If the first read
fails, the outage page is sent with `no-store` and `x-robots-tag: noindex`.

### Security

SvelteKit generates a hash-based Content-Security-Policy (`svelte.config.js`, built with `@bnb/kit/csp`). It uses hashes rather than
nonces because the HTML is publicly cacheable. `connect-src` allows `https:`, since signing a reader in talks to
their handle resolver, DID directory, PDS and authorization server, which can be any host. [`src/hooks.server.ts`](src/hooks.server.ts) adds HSTS,
`nosniff`, `referrer-policy`, `cross-origin-opener-policy` and `permissions-policy`.

### Health

`GET /healthz` returns `ok` without touching the AT Protocol; use it as the host's healthcheck path.

### Performance

CSS is inlined, the display font is preloaded, and the hero image is fetched at high priority. Lighthouse
(mobile): performance 94, accessibility 100, best practices 100, SEO 100.

### Accessibility

The page has a skip link, real buttons for every photograph, and a native modal `<dialog>` lightbox (the
page behind goes inert) that pages by keyboard or swipe and returns focus to the opener on close. The ticker
pauses on hover, click or tap, or from a checkbox that appears on keyboard focus, and works without
JavaScript. The page supports reduced motion, which also stops the ticker. If the app's JavaScript never loads, the scroll reveal switches off
after 4 seconds so the photographs show.

Every component and module has unit or component tests (Vitest, with coverage thresholds). Two layers
of [axe-core](https://github.com/dequelabs/axe-core) tests check against WCAG 2.2 A/AA plus best
practices. Every Storybook story (in the styleguide) is an a11y test that fails on any violation, and
[`e2e/a11y.test.ts`](e2e/a11y.test.ts) scans the built page on a laptop and a phone (after scrolling every
photograph in, so captions are contrast-checked), the open lightbox and the 404 page, and walks the skip
link. The light meter is a `meter` with its reading as text, and the colour strips are decorative. Each heart is a toggle button (`aria-pressed`) with its count in its name, and signing in is a modal dialog that leaves the lightbox's keys alone. Lighthouse CI fails the build below 100 on accessibility or SEO.

## Stack

This app lives in the [websites](../../README.md) monorepo with bnb.im and tierneycyren.com, on the same
SvelteKit stack. What it shares:

- `@bnb/atproto`: PDS resolution, paginated record reads and the CDN/blob URLs
  (`src/lib/atproto.ts` keeps the grain.social join)
- `@bnb/atmosphere`: signing readers in, writing their likes, the Constellation counts and the OAuth
  client metadata
- `@bnb/kit`: the security headers, the hash-based CSP, the stale-while-revalidate cache and the request
  timeout
- `@bnb/ui`: the camera theme (`themes/camera.css`) and the shared `BigName` (masthead), `Marquee`
  (ticker), `Facts` and `Signoff` (footer), `SkipLink` and `Seo` components (the error page is the
  camera's own: a blown-out frame on a contact sheet)
- `@bnb/testing`: the axe helper and the Lighthouse budget

Linting (oxlint, e18e), formatting (oxfmt), knip and Storybook are configured once at the root; the stories
next to each component render, and are checked with axe, in the styleguide (`apps/styleguide`).

## Scripts

```sh
npm run dev             # start the dev server on 127.0.0.1:5173 (localhost works too)
npm run build           # production build (adapter-node)
npm run preview         # preview the production build on 127.0.0.1:4173

npm run check           # svelte-check (types)
npm run test:unit       # Vitest (unit + component)
npm run test:coverage   # the same, with coverage thresholds
npm run test:e2e        # Playwright end-to-end
npm run test:a11y       # the page-level axe e2e suite
npm run test            # unit (run mode) + e2e
npm run lighthouse      # build, then Lighthouse CI via npx (3 mobile runs; report in ./lighthouse-report).
                        # Uses Playwright's Chromium unless CHROME_PATH is set
```

Run them here, or from the monorepo root with `-w apps/tierney.camera`. Lint, format, knip and the stories
run from the root (`npm run lint:all`, `npm run format`, `npm run knip`, `npm run test:storybook`).

> The Playwright, browser-mode Vitest and Lighthouse runs need a browser once: `npx playwright install chromium`.

## Deploy

Built with `@sveltejs/adapter-node`, so it runs anywhere Node runs:

```sh
npm run build
node build            # serves on $PORT (default 3000)
```

On Railway, point the service at the monorepo with `npm run build -w apps/tierney.camera` as the build
command and `node apps/tierney.camera/build` as the start command, set the healthcheck path to `/healthz`,
and map the `tierney.camera` domain to it. To ship a fully static snapshot instead, swap in
`@sveltejs/adapter-static` and set `export const prerender = true`.
