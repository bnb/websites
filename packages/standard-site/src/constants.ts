// Shared by the server side and the browser bundle, so the OAuth metadata the
// site serves and the scope its scripts ask for can't drift apart.
import { repoScope } from '@bnb/atmosphere';

export { CALLBACK_PATH, METADATA_PATH } from '@bnb/atmosphere';

export const DOCUMENT = 'site.standard.document';
export const PUBLICATION = 'site.standard.publication';
export const SUBSCRIPTION = 'site.standard.graph.subscription';
/** upvote.at's upvote: a record whose subject is the document upvoted */
export const UPVOTE = 'at.upvote.signal';
/** upvote.at's comment: its subject is the document, or the comment it replies to */
export const COMMENT = 'at.upvote.comment';

/** Just enough to create and delete subscriptions, upvotes and comments, nothing else. */
export const SCOPE = repoScope(SUBSCRIPTION, UPVOTE, COMMENT);

export const SCRIPT_DIR = 'standard-site';
export const SCRIPT_PATH = `/${SCRIPT_DIR}/subscribe.js`;
/** the upvote button and the comments, for a post page */
export const DISCUSSION_PATH = `/${SCRIPT_DIR}/discussion.js`;
export const WELL_KNOWN_PATH = '/.well-known/site.standard.publication';
