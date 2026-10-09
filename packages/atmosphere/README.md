# @bnb/atmosphere

The sites' browser client for the Atmosphere: signing readers in with ATProto OAuth, writing to their own
repo, and reading what everyone else wrote through microcosm's [Constellation](https://constellation.microcosm.blue)
and [Slingshot](https://slingshot.microcosm.blue), so a page never has to find and call each author's PDS. It's
plain TypeScript with no framework, used by `@bnb/standard-site`'s subscribe button (bundled with esbuild) and
by tierney.camera's likes (SvelteKit).

## `@bnb/atmosphere`

Light enough to import anywhere, server included.

| Export | What it does |
| ------ | ------------ |
| `countLinks({ target, collection, path })` | How many records link to `target` (Constellation `/links/count`) |
| `listLinks({ target, collection, path, did?, limit?, cursor? })` | A page of those records as `{ total, records: [{ did, collection, rkey }], cursor }`; `did` narrows to one account |
| `getRecord({ repo, collection, rkey })` | Anyone's record as `{ uri, cid, value }` (Slingshot) |
| `resolveIdentity(handleOrDid)` | `{ did, handle, pds }` (Slingshot's mini DID document) |
| `AtmosphereError` | What every helper throws: `kind` is `network`, `timeout`, `http` (with `status`), `invalid` or `auth` |
| `needsSignIn(error)` | Whether a write failed because the reader has to sign in again: a dead session, or a 401/403 from their PDS (as for a session signed in with a narrower scope) |
| `repoScope(...collections)` | The narrowest scope: create and delete in those collections only |
| `clientMetadata({ url, name, scope })` | A site's `/oauth-client-metadata.json` (public browser client, DPoP-bound) |
| `METADATA_PATH`, `CALLBACK_PATH`, `siteUrlFor` | Where a site serves its metadata and callback page |
| `isLoopback()`, `moveToLoopback()` | Local dev: sign-in has to start on 127.0.0.1, where the callback lands |
| `rememberDid(key)` | The last signed-in reader's DID in `localStorage`, so their session can be restored |

The reads take `{ timeout, fetch }` (10 seconds and the global `fetch` by default).

## `@bnb/atmosphere/oauth`

Pulls in `@atproto/oauth-client-browser`, so load it with `import()` once a reader clicks or a returning
reader's session needs restoring.

| Export | What it does |
| ------ | ------------ |
| `oauthClient({ clientId, callbackUrl, handleResolver, scope })` | A site's sign-in: `restore(did)` (a session, or null), `signIn(identity, state)` (leaves for the reader's authorization server), `callback()` (on the callback page: `{ session, state, cancelled }`) and `signOut(did)`. In local dev it's a loopback client, so there's no metadata file to host |
| `createRecord(session, collection, record)` | Writes a record (`$type` is the collection); its `{ uri, cid }` |
| `deleteRecord(session, collection, rkey)` | Deletes one |
| `listRecords(session, collection)` | Every record the reader has there, newest first, with each one's `rkey` |

## Testing

`@bnb/atmosphere/testing/oauth-client` stands in for `@atproto/oauth-client-browser`
(`vi.mock('@atproto/oauth-client-browser', () => import('@bnb/atmosphere/testing/oauth-client'))`),
`@bnb/atmosphere/testing/repo` is a reader's repo in memory behind a session (`fakeRepo()`), and
`@bnb/atmosphere/testing/navigation` catches the page leaving in browser tests.

```sh
npm run test:unit -w packages/atmosphere      # Vitest, in Node, no network
npm run test:coverage -w packages/atmosphere
```
