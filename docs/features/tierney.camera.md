# tierney.camera feature list

A photography portfolio read live from the AT Protocol (grain.social records). Parity checklist for the
move into the monorepo, taken from `~/tangled/tierney.camera` as of October 2026.

Legend: **E** = end-to-end test, **U** = unit test, **C** = component test, **S** = Storybook story (and its
axe check), **L** = Lighthouse budget.

## Data

| # | Feature | Where |
| - | ------- | ----- |
| D1 | Resolves the account's PDS from its DID document (`plc.directory`), falling back to a default PDS on error | U (`@bnb/atproto`) |
| D2 | Lists every record in a collection, following cursors, up to 20 pages of 100, warning when it stops early | U (`@bnb/atproto`) |
| D3 | Reads `social.grain.photo`, `social.grain.photo.exif`, `social.grain.gallery`, `social.grain.gallery.item` and the `social.grain.actor.profile` (`self`) | U |
| D4 | Joins them into photos: blob CID, aspect ratio (3:2 fallback), alt, capture date (EXIF, else record), posted date, place, camera, lens, focal, aperture, shutter, ISO | U |
| D5 | Newest *posted* first (not newest captured) | U |
| D6 | The same file posted twice stays two photos (keyed by record URI) | U |
| D7 | Photos without a blob are dropped; missing EXIF / gallery are tolerated; EXIF, galleries and items failing to load don't fail the page | U |
| D8 | EXIF decoding: rationals scaled ×1,000,000; `1/80`, `2.5"`, `ƒ/1.4`, `ISO 12800`, `50mm`; Sony body codes to names (`ILCE-7RM4` → `α7R IV`); `F1.4` → `ƒ/1.4` in lens names | U |
| D9 | Place: gallery location name + region, else locality + region | U |
| D10 | Server cache: 5-minute fresh window, stale-while-revalidate in the background, shared concurrent loads, last good copy kept on failure | U (`@bnb/kit`) |
| D11 | Every AT Protocol request times out after 8 seconds | U (`@bnb/kit`) |
| D12 | `cache-control: public, max-age=60, s-maxage=300, stale-while-revalidate=86400` | U |
| D13 | On a failed first read: an outage message, `no-store` and `x-robots-tag: noindex` | U |
| D14 | Scene brightness per photo as EV at ISO 100 from the EXIF, `log2(N²/t) − log2(ISO/100)`; null without aperture, shutter and ISO | U |
| D15 | Dominant colours per photo (up to 5, dark to light, each with its share), read on the server from the CDN thumbnail with `sharp` and a small k-means; cached by blob CID for the life of the process; never awaited by a page: missing ones are read in the background, 4 at a time, with the 8-second timeout, and show on a later render; a failed thumbnail waits 10 minutes before a retry | U |
| D16 | Each photo's gallery URI (from `social.grain.gallery.item`, only for galleries that exist), which is what a like favorites | U |
| D17 | Like counts per gallery from Constellation (`social.grain.favorite` at `.subject`): one request per gallery, in a cache of their own refreshed at most every 5 minutes, with the 8-second timeout; a gallery it can't count is left out (no number), and counts never fail the page | U |

## Page

| # | Feature | Where |
| - | ------- | ----- |
| P1 | Masthead: name from the grain profile (fallback "tierney cyren") set huge in wide Archivo, first name left, last name right in acid green; first line of the bio tucked into the corner (below it under 900px) | C S E |
| P2 | Featured photograph (`FEATURED_CID`, else newest landscape, else newest), cover-cropped, eager + high priority, with a caption (frame number, short place, date, exposure) | S E |
| P3 | Ticker band: places, then cameras and lenses, then peak ISO; repeated to fill wide screens and looped seamlessly; pauses on hover, click / tap, or a focus-revealed control; stops for reduced motion; its text is hidden from assistive tech (the facts are in the footer) | C S |
| P4 | "The work" heading with photo count and capture month range (`May – Aug 2026`) | U S E |
| P5 | Justified rows: every photo keeps its aspect ratio, every row fills the width, chosen by a dynamic program near a target height; re-run on resize (`ResizeObserver`); the server-rendered / no-JS HTML uses flexbox proportional to aspect ratio | U S |
| P6 | After every 6 photos the next landscape runs full width as a letterbox feature frame, only if at least 3 photos follow | U |
| P7 | Captions: two-digit frame number, short place (US states abbreviated), `MM.DD.YY` stamp, exposure; a compact form (date; aperture + ISO) when the figure is narrow (container query) | U S |
| P8 | `ƒ` stays lowercase inside uppercase text | C |
| P9 | Scroll reveal (fade + rise) only with JS; switched off after 4 s if the app never starts | E |
| P10 | Shimmer placeholder while an image loads; zoom on hover | S |
| P11 | Images: CDN thumbnails first, the full-size CDN render swapped in only when the screen needs the pixels and only after it has loaded, raw PDS blob as the fallback for any failure (including before hydration) | none |
| P12 | Lightbox: native modal `<dialog>` (page inert), counter `01 / 12`, place, capture date, exposure, kit; arrows and swipe (48px) to page; Escape / backdrop to close; focus returns to the opener; focus stays inside (arrows hidden on phones); neighbours' thumbnails preloaded; body scroll locked | S E |
| P13 | Empty state (no photos) and outage state, both linking to grain.social | S |
| P14 | Footer: Based (New York City), Kit, a long gradient runway, the giant `tierney.camera` wordmark, © year + name, Back to top | E S |
| P15 | Skip link to the photographs, first in tab order (ahead of the site rail; left off error pages) | U E |
| P16 | Error / 404 page in the camera's voice: a blown-out frame on a strip of contact-sheet film, the status set huge in the frame and printed on the film edge as its frame number (`▸ 404A`), a plain line on what happened, links back to the photographs and grain.social | C E |
| P17 | Site rail (`SiteRail`): links to all three sites, tierney.camera filled acid green; a strip on top on phones, pinned down the left from 760px | U S |
| P18 | Light meter in the lightbox: a needle on an arc from EV −2 to 16, drawn to scale with every other stop labelled and an acid low-light band (below EV 5); the needle swings up to its reading on open (an instant jump with reduced motion); the reading as text (`EV 1.6`, plus "Low light"), exposed as a `meter` role with its value; left out when aperture, shutter or ISO is missing | C S E |
| P19 | Colour strip under each gallery caption and under the lightbox's place and date: the photo's dominant colours, each as wide as its share; decorative (`aria-hidden`); its 4px is always reserved, so a palette arriving on a later render moves nothing | C S |
| P20 | Like (grain.social's favorite of the photo's gallery) on every photo that has a gallery: in the gallery caption, the featured frame's caption and the lightbox bar beside Close. A real toggle button (`aria-pressed`) named `Like photograph 03, 8 likes`; an outlined heart and the count, a filled acid heart when liked (a pop on liking, none with reduced motion); no number for zero or an uncounted gallery; photos without a gallery show no heart | C S E |
| P21 | Liking signs a new reader in first: a modal dialog (over the lightbox too, whose keys leave it alone) asking for their handle, "Any Atmosphere account works, Bluesky included."; a returning reader is restored from their saved session on load, their likes filled in without moving anything, and one whose session expired goes straight back to their authorization server | C S E |
| P22 | Optimistic likes: the heart and count change at once, a like checks the reader's repo first so it's never doubled, an unlike deletes every like of that gallery, and a failure changes them back with a short message for 6 seconds | C S |
| P23 | A like asked for before signing in is made once the reader is back on the photographs, which scroll to it | C |
| P24 | `/oauth/callback/`: finishes signing in and sends the reader back (only ever to this site); a plain error with a way back if it can't; `noindex`; the skip link is left off it | C E |

## Head, security and hosting

| # | Feature | Where |
| - | ------- | ----- |
| H1 | Title `<name> · photography`, description (bio or fallback), canonical, `rel="me"` to grain.social, Open Graph (the `/og.png` share card, 1200×630), `summary_large_image` | E |
| H2 | `theme-color` and `color-scheme` dark; SVG favicon; `robots.txt`; preconnect to `cdn.bsky.app` | none |
| H3 | Hash-based CSP (cacheable pages, so no nonces) that also covers the inline script in `app.html`; `connect-src https:` for signing readers in (their handle resolver, DID directory, PDS and authorization server can be any host) | E |
| H4 | HSTS, `nosniff`, `referrer-policy`, `cross-origin-opener-policy`, `permissions-policy` | E |
| H5 | `GET /healthz` → `ok`, without touching the AT Protocol | E |
| H6 | CSS inlined (under 16 KB), Latin Archivo preloaded, Fontsource self-hosted fonts | L |
| H7 | adapter-node; Railway with `/healthz` | none |
| H8 | AT Tags: `at:me` on every page; on the home page an `at:alternate` for the grain.social profile and every photograph, and `at:author` | U E |
| H9 | `GET /og.png`: a generated 1200×630 share card (satori + resvg, static Archivo 900 and IBM Plex Mono from Fontsource): the name across the top with the last name in acid, the featured photo letterboxed with a mono caption (place, date, exposure); kept in memory until what's on it changes; `max-age=3600, s-maxage=86400`; with the PDS or the CDN down, a card in type alone with `max-age=300` | U E |
| H10 | `GET /oauth-client-metadata.json`: the OAuth client (`@bnb/atmosphere`'s `clientMetadata`), scope `atproto repo:social.grain.favorite?action=create&action=delete` and nothing else, DPoP-bound, no client secret; local dev signs in with a loopback client on 127.0.0.1 instead (the dev server and preview listen there; a page on localhost moves there before signing in) | U E |

## Quality

| # | Feature | Where |
| - | ------- | ----- |
| Q1 | axe (WCAG 2.2 AA + best practices) on every story, the page on a laptop and a phone (after revealing every photo), the open lightbox and the 404 | S E |
| Q2 | Lighthouse CI: accessibility and SEO must be 100; performance ≥ 0.85 and best practices ≥ 0.9 warn | L |
| Q3 | oxlint, oxfmt, e18e lint, knip, svelte-check | none |
