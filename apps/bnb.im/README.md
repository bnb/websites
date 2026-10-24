# bnb.im

Tierney Cyren's blog. Posts are Markdown files in [`posts/`](posts), prerendered to static HTML by
SvelteKit (adapter-static) and published to GitHub Pages. Pages ship no client-side JavaScript except
standard.site's scripts on posts: the subscribe button, the upvote button and the comments. The feature list, which doubles as the parity checklist for the
rewrite, is in [`docs/features/bnb.im.md`](../../docs/features/bnb.im.md).

## Writing

Add `posts/<slug>.md` with front matter:

```yaml
---
title: My Post
description: One or two sentences, used in the head, the feed and the social image.
date: 2026-10-04
topic: AT Protocol
tags:
  - post # marks it as a post; not shown
  - atproto
series: esm-in-node-js # optional; series live in src/lib/series.ts
part: '4' # with series
draft: true # optional; drafts aren't published to the AT Protocol
---
```

`<!-- excerpt -->` marks the end of the excerpt and is taken out of the post. A bare `bsky.app` post URL on
its own line becomes a static embed at build time (fetches are cached in `.cache/bluesky` for a day).

Beyond plain Markdown:

````md
> [!PULL]
> A pull quote, on a highlighter slab.

```js title="index.js"
// a file name tab; the language gets a sticker either way
```

A claim.[^1] Or a note written inline.^[Like this.]

[^1]: Footnotes list at the end, and sit in the margin on wide screens.
````

## How it works

- `src/lib/server/posts.ts` reads `posts/*.md` (via `import.meta.glob`; front matter with `yaml` in
  `front-matter.ts`): midnight-UTC dates, date-then-file-name order, the excerpt separator removed.
- `src/lib/server/markdown.ts` is the markdown-it setup the posts were written for: HTML, soft breaks, fuzzy
  linkify, heading ids from `slugify` with `#` permalinks, and Prism highlighting (`highlight.ts`). The
  permalinks are out of the tab order (they're `aria-hidden`), and code blocks take keyboard focus so they can
  be scrolled. On top of that: pull quotes (`pull-quote.ts`), footnotes as sidenotes
  (`footnotes.ts`, which also turns them into a list for the leaflet record), and code block file tabs.
- Print styles (a two-column zine page) are in `src/lib/styles/print.css`, imported by `app.css`.
- `bluesky.ts` renders the embeds, `feed.ts` the Atom feed (with `absolute-urls.ts` making each post's URLs
  absolute), and `social.ts` the 1200×630 cover images (satori + resvg, fonts from Fontsource), each as a
  prerendered route.
- `standard-site.ts` is the site's standard.site publication, on
  [`@bnb/standard-site`](../../packages/standard-site): the record URIs, AT Tags and link tags,
  `/.well-known/site.standard.publication`, the OAuth client metadata and callback page, and the bundle of
  the subscribe button, upvote button and comments at `/standard-site/` (built by the package; `npm run dev`
  and `npm run build` build it first).

## Upvotes and comments

Each post ends with an upvote button and its comments, both on the post's `site.standard.document` record
with upvote.at's lexicons (`at.upvote.signal`, `at.upvote.comment`), so readers upvote
and comment from their own Atmosphere account and the records live in their repos. Drafts have no record, so
they have neither. The elements are `@bnb/standard-site`'s, from `/standard-site/discussion.js`
([`Upvote.svelte`](src/lib/components/Upvote.svelte) and [`Comments.svelte`](src/lib/components/Comments.svelte)
place and style them). Counts and threads come from microcosm's Constellation and each comment from Slingshot;
nothing is fetched at build time, and the OAuth client loads only when a reader writes. Comments their author
labelled (nudity, gore and so on) never show.

To hide a comment, or everyone's comments from an account, add its at:// URI or the account's DID to
`HIDDEN_COMMENTS` in [`src/lib/site.ts`](src/lib/site.ts) and redeploy. A hidden comment's replies go with it.

```ts
export const HIDDEN_COMMENTS: readonly string[] = [
	'at://did:plc:example/at.upvote.comment/3kexample', // one comment, and its replies
	'did:plc:example' // everything this account writes
];
```

## Publishing to the AT Protocol

```sh
npm run publish -w apps/bnb.im              # build, sync, commit pinned atUris, push
npm run publish -w apps/bnb.im -- --dry-run # what would change on the PDS (no password needed)
npm run publish -w apps/bnb.im -- --prune   # also delete records no post maps to
```

Publishing syncs every post to the PDS as a `site.standard.document` with leaflet rich text, converted from
the same markdown-it tokens the page renders from (`src/lib/server/publish.ts`, on `@bnb/standard-site`).
Records are diffed against the PDS, so only what changed is written. New posts get their `atUri` pinned into
their front matter; the script commits that and pushes, and the deploy workflow puts the site live. Put
`ATPROTO_APP_PASSWORD` (an app password) in a gitignored `.env`.

## Scripts

```sh
npm run dev           # http://127.0.0.1:5174 (127.0.0.1, so signing in with the loopback OAuth client works)
npm run build         # static site in build/
npm run preview       # http://127.0.0.1:4174
npm run check         # svelte-check
npm run test:unit     # Vitest (Node + browser)
npm run test:coverage # with thresholds
npm run test:e2e      # Playwright, including axe on every page type at two widths
npm run lighthouse    # Lighthouse CI on the index, a post and the series page
```

## Deploy

`.github/workflows/deploy-bnb.im.yml` publishes `build/` to GitHub Pages. CI calls it on pushes to `main`
that change bnb.im, once its checks pass and the `BNB_IM_PAGES` repository variable is `true`; it can also
be run by hand. It needs the repository's Pages source set to "GitHub Actions" and its custom domain set to
`bnb.im`, which only one repository can hold, so the old `bnb/bnb.im` repo's Pages site has to let go of it
first. `404.html` is prerendered for missing paths.
