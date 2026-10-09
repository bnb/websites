# bnb.im feature list

Tierney Cyren's blog: writing on open source, JavaScript, Node.js, standards and the AT Protocol. This is
the parity checklist for the SvelteKit rewrite. Every item was taken from the Eleventy site
(`~/GitHub/bnb/bnb.im`, as of October 2026), and each one is marked with where the new site covers it.

Legend: **E** = covered by an end-to-end test, **U** = unit test, **S** = Storybook story (and its axe
check), **P** = checked during the migration against the Eleventy build: every page's content and head,
the feed and the standard.site files compared token by token, full-page screenshots compared at laptop and
phone widths, and the publish records (leaflet blocks, text, tags, dates, URIs) compared for all 14 posts.

## Content

| # | Feature | Where |
| - | ------- | ----- |
| C1 | 14 posts written in Markdown with YAML front matter (`title`, `description`, `date`, `topic`, `tags`, `series`, `part`, `atUri`, `layout`) in `posts/` | `apps/bnb.im/posts/`: U P |
| C2 | Post URLs are `/posts/<file-name>/` with a trailing slash | E P |
| C3 | Posts are dated by their front matter date, read and shown in UTC | U |
| C4 | Posts that share a date sort by file name (Eleventy's tie-break) | U |
| C5 | `<!-- excerpt -->` separator stays in the HTML as an invisible comment | U P |
| C6 | Front matter with stray commas in tags (`webdev,`) is cleaned for display | U |
| C7 | The `post` tag is a collection marker, never shown as a tag | U |
| C8 | Posts with `draft: true` are left out of publishing | U |
| C9 | A series (`esm-in-node-js`) groups posts by `series` + `part`; series titles and descriptions live in `src/lib/series.ts` (was `data/seriesData.json`) | U E |
| C10 | A series page exists only when the series has more than one post | U |
| C11 | Series parts are ordered by `part`, not by date (same-day posts) | U |
| C12 | Static assets: `/img/avatar.jpg`, `/img/small-card.png`, `/img/small-card.psd` | P |
| C13 | `CNAME` (`bnb.im`) and `.nojekyll` at the site root | P |

## Markdown rendering

| # | Feature | Where |
| - | ------- | ----- |
| M1 | markdown-it 13 with `html`, `breaks` and `linkify` on | U P |
| M2 | Heading permalinks (`markdown-it-anchor`): `id` slugs made with `slugify` (lowercase, `-`), `tabindex="-1"`, and an `aria-hidden` `#` link with class `direct-link` placed after the text, on h1–h4 | U P |
| M3 | Fenced code highlighted at build time with Prism (the old site's markup): `<pre class="language-x"><code class="language-x">`, language aliases, `diff` and `diff-<lang>` blocks, `text` left plain, unknown languages left plain | U P |
| M4 | Prism token colours tuned for the black code blocks (`code.css`) | S |
| M5 | Inline Markdown in titles (`` `--changedSince` ``) rendered as HTML on the index, posts and series pages | U E |
| M6 | Two posts contain GitHub Actions `${{ }}` expressions that must render literally | U P |
| M7 | Pull quotes: a blockquote whose first line is `[!PULL]` (GitHub's alert syntax) is set big on a yellow highlighter slab with a hard shadow; the marker is taken out of the tokens, so the feed and the leaflet record get a plain blockquote (`pull-quote.ts`) | U |
| M8 | Code block tabs: a fence's info string gives a language sticker and, with `title="file.js"`, a file name tab (```` ```js title="index.js" ````), wrapped in a `<figure>` around the unchanged `<pre>`; the record's code block keeps just the language | U E |
| M9 | Footnotes (`markdown-it-footnote`): the numbered list at the end, with named back links, and on wide screens each note beside its first reference as a CSS sidenote (from a `data-sidenote` attribute, so there's no second copy in the markup or the feed). The record gets `[1]` captions and the notes as an ordered list after a rule (`footnotes.ts`) | U |

## Bluesky embeds

| # | Feature | Where |
| - | ------- | ----- |
| B1 | A bare `bsky.app` post link alone in a paragraph becomes a static embed at build time: no third-party script or iframe | U P |
| B2 | Embed shows avatar, display name, handle, Bluesky logo link, text with rich-text facets (links, mentions, hashtags, using UTF-8 byte offsets), date, "View on Bluesky" | U |
| B3 | Reply context ("Replying to @handle") from the parent post | U |
| B4 | Media: 1–4 images (grid by count), galleries (scroll-snap strip), video (poster linking out), external link cards, quoted posts, quoted feeds / lists / starter packs, record-with-media | U |
| B5 | Respects `!no-unauthenticated` (author opted out → link stays a link) and hides sensitive media (`porn`, `sexual`, `nudity`, `graphic-media`, `gore`) behind a notice | U |
| B6 | Not-found, blocked and detached quotes show a notice | U |
| B7 | Thread fetches are cached in `.cache/bluesky` for 24 h; a stale cache is used when the network fails; a post the API says is gone stays gone; one fetch per post per build | U |
| B8 | ~~Mini embed (`bsky-embed-mini`) for excerpts~~: not carried over: no page showed excerpts, so the filter and its CSS were unused | none |
| B9 | Links with custom text (`[like this](https://bsky.app/…)`) are left alone | U |

## Pages

| # | Feature | Where |
| - | ------- | ----- |
| P1 | Home (`/`): huge two-line "Tierney / Cyren." heading (pink full stop), "Who?" intro with highlighted text, and a table of every post: zero-padded number (newest is highest), title, series tag (`ESM in Node.js 2/3`, links to the series), topic chip, year (now the year heads its group of rows and each row shows its day and month; see P6) | E S P |
| P2 | Post page: "← Index" link, title, meta strip (Date `dd.mm.yyyy`, Read time at ~230 wpm, Topic, Series link with part/total, Tags as `#tag`), the prose, the upvote button, the subscribe box ("Want more garbage?") and the comments (see A11–A20) | E S P |
| P3 | Series page (`/series/<slug>/`): back link, "A series in N parts" kicker, title, description, parts table (part, title, year) | E P |
| P4 | Atom feed (`/feed.xml`): title, subtitle "Software and Selected Garbage", self link, updated = newest post, author name + email, every post oldest first with absolute URLs in its HTML (`href`/`src` etc. rewritten against the post URL) | U E P |
| P5 | Not-found page | E (new: GitHub Pages 404 was the default) |
| P6 | Year breaks on the index: a giant outlined year (the newest filled pink) with its post count heads each year's rows as a `<th scope="rowgroup">`, and each row shows its day and month (`PostTable` `byYear`) | U E S |
| P7 | ~~Reading receipt at the end of each post (`Receipt`)~~, removed | |
| P8 | ~~"Published to the Atmosphere" rubber stamp linking the post's record (`AtmosphereStamp`)~~, removed | |
| P9 | Reading progress bar on posts: CSS scroll-driven animation, hidden without support or with reduced motion | U E |
| P10 | The 404 and error pages set the status as a heap of fallen digits ("Selected garbage"), with the message and a way back (`GarbageStatus`) | U E S |

## Layout and chrome

| # | Feature | Where |
| - | ------- | ----- |
| L1 | Top bar: a boxed RSS link with a hard shadow (no social accounts) | E S |
| L11 | Site rail (`SiteRail`): links to all three sites, bnb.im filled pink and linking home; a strip on top on phones, pinned down the left from 760px (replaces the old "bnb.im" home link) | U S |
| L2 | Home shows the big `<h1>` name; other pages show a smaller name link | E S |
| L3 | Pink marquee under the header: "Software and selected garbage ✶" then every post topic, most recently written about first, looping seamlessly | U S |
| L4 | Marquee stops for reduced motion | S |
| L5 | Footer: a giant pink ":)" | S |
| L6 | "Loud" design: white page, 3px black rules, hard offset shadows, hot pink `#ff0099` as a fill, yellow `#fff200` highlights, mint strings in code; Archivo Black display, Space Grotesk body, DM Mono labels | S |
| L7 | Responsive: intro collapses to one column, topic column hidden, tighter numbers under 640px | E |
| L8 | Prose styles: h2–h4, list markers, inline code, black code blocks with pink shadow, blockquotes, bordered images, scrollable tables, rules | S P |
| L9 | Permalink `#` appears on heading hover (hover-capable devices) | S |
| L10 | Selection, focus-visible outlines, link underline colours | S |
| L12 | Page changes are cross-document view transitions (CSS only, off for reduced motion): the page crossfades, the big name morphs between the huge home name and the small one, and the marquee slides to its new place. Each is only named while it hasn't started to scroll off the top, so nothing flies in from off screen | E |
| L13 | Print: a two-column zine page with the name as the masthead, no rail, marquee, subscribe box or footer, code in ink, outside links followed by their URL (`src/lib/styles/print.css`) | E |

## Metadata and SEO

| # | Feature | Where |
| - | ------- | ----- |
| H1 | `<title>` and description from the post, else the site (`Tierney Cyren`, "On JavaScript, Node.js Software, Standards, and real life.") | E P |
| H2 | `theme-color` `#ff0099` | P |
| H3 | Open Graph + Twitter tags: `og:url`, `og:title`, `og:description`, `og:image`, `twitter:image`, `twitter:creator` (`@bitandbang`); `summary_large_image` with 1200×630 dimensions on posts, `summary` with `small-card.png` elsewhere | E P |
| H4 | RSS `<link rel="alternate">` on every page | P |
| H5 | Per-post social images (1200×630 PNG at `/img/social/<slug>.png`): pink bar, title in Playfair Display, description (truncated to 140), "Tierney Cyren", date, "bnb.im", rendered with satori + resvg | U E |

## AT Protocol (standard.site)

| # | Feature | Where |
| - | ------- | ----- |
| A1 | `at:me` meta on every page; on posts also `at:canonical`, `at:alternate`, `at:author`, and `<link rel="site.standard.document">` / `site.standard.publication` | U E P |
| A2 | A post's record URI is its pinned `atUri`, or derived from its date and slug (deterministic TID) before the first publish | U |
| A3 | `/.well-known/site.standard.publication` holds the publication URI | E P |
| A4 | `/oauth-client-metadata.json` and `/oauth/callback/` for the site's one browser OAuth client, scoped to creating and deleting subscriptions, upvotes and comments (`site.standard.graph.subscription`, `at.upvote.signal`, `at.upvote.comment`) and nothing else | U E P |
| A5 | `<standard-site-subscribe>` button and its script at `/standard-site/subscribe.js` (OAuth client loaded on click) | E |
| A6 | Subscribe button styling (pink button, yellow box, form, hint, status, error) | S |
| A7 | `npm run publish`: refuses off `main` or when behind origin, builds, syncs every post to the PDS as `site.standard.document` records with leaflet rich text (`--dry-run`, `--prune`), pins new `atUri`s into front matter, checks the built HTML links each record, commits and pushes | U P |
| A8 | All of the above is native to the monorepo (`@bnb/standard-site`): no Eleventy and no Eleventy plugin. The record payloads it builds were checked against the old plugin's for all 14 posts | U P |
| A9 | Cover images on records come from the generated social images | U |
| A10 | `ATPROTO_APP_PASSWORD` read from a gitignored `.env` | none |

## Upvotes and comments

Both are on the post's `site.standard.document` record, with upvote.at's lexicons, so drafts (no record) have
neither. The elements come from `/standard-site/discussion.js`; everything they read is public
(Constellation and Slingshot), and the OAuth client loads only when a reader writes.

| # | Feature | Where |
| - | ------- | ----- |
| A11 | Upvote button between the post and the subscribe box: `▲ Upvote` with Constellation's count, a toggle (`aria-pressed`, named `Upvote, 1 upvote`), pink when it's yours; a returning reader's own upvote shown from Constellation; no number for none or when Constellation is down | U E S |
| A12 | Upvoting writes an `at.upvote.signal` to the reader's repo, optimistically (with rollback and a short message); it checks their repo first so it never stacks a second, and taking it back deletes every one they've given the post | U |
| A13 | Comments section after the subscribe box: the post's comments oldest first, replies threaded under what they answer, four levels deep, the newest 25 (10 replies) first with "Show earlier comments" / "Show earlier replies"; each with the author's handle (a DID if it won't resolve) and date | U E S |
| A14 | Replies are found by asking Constellation what links to a comment already shown, so a reply only ever appears under a comment that belongs to the post; each record comes from Slingshot (four at a time) and is checked to point at what it was listed under; handles are looked up once per page view | U |
| A15 | Comment text is Markdown, rendered safely (markdown-it, lazily loaded): no raw HTML, no images or headings, links open in a new tab with `rel="nofollow ugc noopener noreferrer"`, and `javascript:` links refused | U E |
| A16 | Hidden: any comment its author labelled (nudity, gore, `!no-unauthenticated`, anything), and the comments and accounts in `HIDDEN_COMMENTS` (`src/lib/site.ts`), with their replies | U |
| A17 | Signed out: "Sign in with your Atmosphere account to comment", and Reply, open a sign-in dialog; signed in: "Signed in as @handle · Sign out", a comment box, Reply on each comment (an inline box), and Delete on your own (confirmed in the page) | U E S |
| A18 | Writing checks the lexicon's limits (1–5,000 graphemes, 50,000 bytes) with a count from 90% of the way; a new comment shows at once (Constellation takes a moment) and isn't shown twice when it catches up; focus moves to it, and "Comment posted." / "Reply posted." / "Comment deleted." are announced | U |
| A19 | A reader without a session, or with one their PDS refuses (an older, narrower scope), signs in again and their upvote, comment, reply or delete is finished when they're back | U |
| A20 | Loading (the page's ghost lines, so nothing jumps), "No comments yet.", a load error with Try again, and without JavaScript a one-line note and no upvote | U E S |

## Hosting

| # | Feature | Where |
| - | ------- | ----- |
| D1 | Fully static output, no client-side JavaScript except standard.site's scripts on posts: the subscribe button, the upvote and the comments | E |
| D2 | GitHub Pages with the `bnb.im` custom domain | `.github/workflows/deploy-bnb.im.yml` |

## Deliberate differences

The rewrite renders the same HTML as the Eleventy site except for:

- Heading permalinks (`aria-hidden`) carry `tabindex="-1"`, and code blocks carry `tabindex="0"`, fixing
  two axe violations (aria-hidden-focus, scrollable-region-focusable) in the old markup.
- markdown-it is 15 (13 had advisories in linkify-it). Fuzzy links are switched back on so output matches;
  the one change is that an image's alt text now includes inline code from its Markdown, in one post.
- The meta strip and the marquee are the shared `Facts` and `Marquee` components, so their markup gained a
  wrapper and a pause control.
- `<main>` has an id for the skip link; there's a `404.html`.
- Social images are re-rendered with bundled fonts, so their bytes differ from the old ones and the next
  publish uploads new cover images.

## Improvements in the rewrite

Not in the Eleventy site, added on the shared stack:

- Fonts are self-hosted with Fontsource (no Google Fonts requests); social images use bundled fonts too, so
  builds don't download fonts.
- A skip link, a pausable marquee (WCAG 2.2.2) that works without JavaScript, and a 404 page.
- A Content-Security-Policy (meta, hash-based).
- Type checking, oxlint, oxfmt, e18e lint, knip, unit tests with coverage thresholds, Playwright end-to-end
  and axe tests, Storybook stories with axe checks, and Lighthouse budgets. (The Eleventy site had `standard`
  lint only.)
- `luxon` is gone; dates are formatted with small UTC helpers.
