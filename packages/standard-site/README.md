# @bnb/standard-site

[standard.site](https://standard.site) for the sites, without a site generator: posts as
`site.standard.document` records with leaflet rich text, synced to the PDS, the tags and files a site
serves, and the browser scripts readers use on it. bnb.im is the one site using it today.

## Server side

- `@bnb/standard-site`: record URIs (`documentUris`, `deterministicTid`), AT Tags and link tags
  (`headTags`), the Markdown → leaflet conversion (`toContent`), and the files a site serves:
  `clientMetadata` (its `/oauth-client-metadata.json`) and `callbackPage` (its `/oauth/callback/`).
- `@bnb/standard-site/sync`: diffs a site's posts against its PDS and writes only what changed, pinning new
  record URIs into front matter (`npm run publish -w apps/bnb.im`).

## Browser scripts

Built by `npm run build -w packages/standard-site` into `dist/client`, which a site serves at
`/standard-site/` (bnb.im's dev and build run it first). Each entry is small; the OAuth client and the
writes are a chunk loaded only when a reader writes, and the comments' Markdown renderer a chunk loaded only
when there are comments. Every element renders into the light DOM, so the site's own CSS styles it.

| Script | Elements | What it does |
| ------ | -------- | ------------ |
| `subscribe.js` | `<standard-site-subscribe publication="at://…">` | Subscribes a reader to the publication (`site.standard.graph.subscription`). On a page marked `data-standard-site-callback`, it finishes signing in instead |
| `discussion.js` | `<standard-site-upvote subject="at://…">` | Upvotes a document (`at.upvote.signal`): the count from Constellation, optimistic, never stacked |
| | `<standard-site-comments subject="at://…" hide="…">` | The document's comments (`at.upvote.comment`), oldest first, threaded four deep, with comment, reply, delete and sign out; `hide` is a space-separated list of comment URIs and DIDs to leave out |

They share one OAuth client per site (scope: create and delete subscriptions, upvotes and comments), the
reader who signed in last, and a sign-in dialog ("Any Atmosphere account works"). Reading is public:
Constellation for counts and who replied to what, Slingshot for records and handles. When a reader has to
sign in (or sign in again, because their session expired or was signed in with a narrower scope), what
they asked for (an upvote, a comment, a delete) rides along and is finished when they're back on the page.

Comment text is Markdown, rendered with markdown-it with raw HTML off, no images or headings, and links that
open apart (`rel="nofollow ugc noopener noreferrer"`). Self-labelled comments never show.

The shared pieces (OAuth, repo writes, Constellation and Slingshot) are in
[`@bnb/atmosphere`](../atmosphere).

## Tests

```sh
npm run test:unit -w packages/standard-site      # Node, and the elements in Chromium (no network)
npm run test:coverage -w packages/standard-site
```

The browser tests stand in for Constellation and Slingshot with `src/test/atmosphere.ts`, for the OAuth
client with `@bnb/atmosphere/testing/oauth-client` and for the reader's repo with
`@bnb/atmosphere/testing/repo`.
