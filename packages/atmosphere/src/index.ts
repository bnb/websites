// The Atmosphere, from a site's pages: reads from microcosm's Constellation
// (who links to what) and Slingshot (any record or identity), and what a site
// serves so readers can sign in. Signing in, and writing to a signed-in
// reader's repo, are in ./oauth, kept apart because they're heavy.
export { AtmosphereError, needsSignIn } from './errors';
export type { ReadOptions } from './http';
export {
	CONSTELLATION,
	countLinks,
	listLinks,
	type LinkingRecord,
	type LinkPage,
	type LinkQuery
} from './constellation';
export {
	SLINGSHOT,
	getRecord,
	resolveIdentity,
	type Identity,
	type RecordRef,
	type RepoRecord
} from './slingshot';
export { isLoopback, moveToLoopback } from './loopback';
export { rememberDid } from './storage';
export { CALLBACK_PATH, METADATA_PATH, clientMetadata, repoScope, siteUrlFor } from './site';
