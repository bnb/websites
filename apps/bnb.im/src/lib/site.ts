// Site-wide settings (were data/metadata.json and feed.njk's front matter).

export const SITE_URL = 'https://bnb.im';
export const SITE_TITLE = 'Tierney Cyren';
export const SITE_DESCRIPTION = 'On JavaScript, Node.js Software, Standards, and real life.';
export const TAGLINE = 'Software and selected garbage';

export const AUTHOR = { name: 'Tierney Cyren', email: 'hello@bnb.im' };

export const FEED = {
	title: 'Tierney Cyren',
	subtitle: 'Software and Selected Garbage',
	url: `${SITE_URL}/feed.xml`
};

export const TWITTER_CREATOR = '@bitandbang';

/** The card for pages that aren't posts; posts get their own (see social.ts). */
export const SMALL_CARD = `${SITE_URL}/img/small-card.png`;

/**
 * Comments kept off the posts, applied before anything renders: a comment's
 * at:// URI hides it and its replies, and an account's DID hides everything
 * they've written. Space-free strings, like
 * 'at://did:plc:…/at.upvote.comment/3k…' or 'did:plc:…'.
 */
export const HIDDEN_COMMENTS: readonly string[] = [];
