# tierneycyren.com feature list

tierney cyren's DJ site, new in the monorepo. It follows tierney.camera's pattern: everything is read live
from the AT Protocol, from records another app (here, [plyr.fm](https://plyr.fm)) writes to the account's
own repository.

Legend: **E** = end-to-end test, **U** = unit test, **C** = component test, **S** = Storybook story (and
its axe check).

## Data

| # | Feature | Where |
| - | ------- | ----- |
| D1 | Mixes are `fm.plyr.track` records; the bio is `fm.plyr.actor.profile/self` | U |
| D2 | PDS resolved from the DID document; paginated reads (`@bnb/atproto`) | U |
| D3 | Each mix streams from plyr.fm's CDN, then the raw blob from the PDS; only https URLs are used; a track with nothing to stream or no title is dropped | U |
| D4 | Format and MIME type from the record, or the file extension | U |
| D5 | Newest first | U |
| D6 | Five-minute stale-while-revalidate cache, 8 s request timeouts, last good copy kept through an outage | U |
| D7 | `cache-control: public, max-age=60, s-maxage=300, stale-while-revalidate=86400`; on a failed first read, `no-store` and `noindex` | U E |

## Page

| # | Feature | Where |
| - | ------- | ----- |
| P1 | Masthead: "DJ" kicker, the name huge in condensed Archivo (last name in cyan), the plyr.fm bio (fallback "girl rave dj"), decorative laser fans (they follow the music, see M1) | C S E |
| P2 | Marquee of the bio and every mix title, pausable (click, hover, or a checkbox on keyboard focus; works without JS), stopped for reduced motion | C S E |
| P3 | "Mixes" heading with count and total running time ("2 mixes · 1 hr 19 min") | U C S |
| P4 | Each mix: cover art as the label of a record (M2), number (counting up from the oldest), title, length (with an ISO 8601 `datetime`) and its bar to scale (M3), posted date, format, description with its line breaks | C S |
| P5 | Native audio player per mix: `preload="none"`, CDN then PDS sources, `crossorigin="anonymous"` (both send CORS headers, so Web Audio can analyse it), labelled, one mix playing at a time (`player.svelte.ts`) | C E |
| P6 | Empty ("No mixes up yet") and outage states, both linking to plyr.fm | C S |
| P7 | Footer: optional booking address (`BOOKING_EMAIL`) and mix summary (left out when there are neither), the wordmark, © year, back to top | C S |
| P8 | Skip link to the mixes, first in tab order (ahead of the site rail; left off error pages) | U E |
| P9 | Error page in the DJ voice: "Needle up", the status huge in cyan, "Track not found" for a 404 (otherwise the error's message), the needle lifting off a record, back to the mixes | C E |
| P10 | Site rail (`SiteRail`): links to all three sites, tierneycyren.com filled cyan; a strip on top on phones, pinned down the left from 760px | U S |

## Playback

One shared player (`src/lib/player.svelte.ts`) follows whichever native `<audio>` is playing; one
AudioContext and AnalyserNode (`src/lib/audio.ts`) feed the visuals from a frame loop that runs only while
a mix plays in a visible tab. Nothing is analysed for reduced motion. A mix is routed through Web Audio only
once the context is running, so a browser that won't start it plays the mix untouched.

| # | Feature | Where |
| - | ------- | ----- |
| M1 | Lasers that follow the music: the masthead's fans brighten with the bass and sweep faster the harder it hits (`--energy`, `--sweep`); a steady glow when there's no analyser; still for reduced motion | U C |
| M2 | Record platter: the cover is the label of a grooved record that spins (33⅓ rpm) while its mix plays, with a tonearm that swings in and stays down when paused. Drag it round to scrub (a turn is a minute, the playhead cues as it goes), tap to play or pause; `touch-action: pan-y` keeps phones scrolling. Hidden from assistive tech (the audio controls do the same); no spin for reduced motion | U C S |
| M3 | Set lengths to scale: a bar per mix against the longest, ticked every ten minutes, server-rendered; a magenta playhead on the mix on the deck | U C S |
| M4 | Spectrum strip under the marquee: 64 log-spaced bars on a canvas while a mix plays, flat CSS ticks otherwise (and without JS, and for reduced motion); decorative | U C S |
| M5 | Lock-screen controls (Media Session): title, artist, the cover at 256 and 512 px; play, pause, seek back and forward, seek to; playback state and position | U C E |
| M6 | Now-playing bar: sticky at the foot of the page column once a mix has played (after the footer at the end, so it hides nothing), play/pause button labelled with the mix, elapsed / total, a top-edge progress line; a title too long for the bar scrolls while playing (static for reduced motion); a status line announces only a change of mix | C S E |
| M7 | Blacklight: a UV glow on the headings, faint at rest, brighter while a mix plays and pulsing on the name with the bass | C |
| M8 | Strobe on the drop: a faint magenta wash over the masthead on big bass hits (loud, and well above the last few seconds), at least 400 ms apart, so never more than three in a second (WCAG 2.3.1); off for reduced motion | U C |

## Head, security and hosting

| # | Feature | Where |
| - | ------- | ----- |
| H1 | Title "tierney cyren · dj", description from the bio, canonical, `rel="me"` to plyr.fm, Open Graph and a large Twitter card with the generated share card (H7), versioned by the newest mix (`/og.png?v=<rkey>`) | C E |
| H2 | `theme-color`, `color-scheme: dark`, SVG favicon, `robots.txt`, preconnect to plyr.fm's image CDN | none |
| H3 | Hash-based CSP with `media-src` for the audio CDN and the PDS; HSTS, `nosniff`, referrer, COOP and permissions policies | E |
| H4 | `GET /healthz` | U E |
| H5 | adapter-node | none |
| H6 | AT Tags: `at:me` on every page; on the home page an `at:alternate` for the plyr.fm profile and every mix, and `at:author` | U E |
| H7 | `GET /og.png`: a 1200×630 share card (satori + resvg, fonts inlined into the server build): laser fans, the name in Archivo Narrow, the newest cover as a record label, the mix count and running time. Kept in memory until the newest cover or the count changes; `public, max-age=3600, s-maxage=86400`. With the PDS or the cover unreachable, a card without them for 60 s, redrawn on the next request | U E |

## Quality

| # | Feature | Where |
| - | ------- | ----- |
| Q1 | axe (WCAG 2.2 AA + best practices) on the page at laptop and phone widths, the 404, and every story | E S |
| Q2 | Lighthouse CI budget (a11y and SEO 100) | none |
| Q3 | Coverage thresholds: 98% lines, 97% functions and statements, 86% branches | none |
