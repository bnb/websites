// The upvote button and the comments, for a post page: <standard-site-upvote>
// and <standard-site-comments>. Everything they read is public (Constellation
// and Slingshot); the OAuth client loads only when a reader writes.
import { StandardSiteComments } from './comments';
import { clientConfig } from './shared';
import { StandardSiteUpvote } from './upvote';
import { Writer } from './writer';

// served from /standard-site/ like the subscribe button, which shares its
// sign-in (kept in a variable so the bundler leaves it alone)
const here = import.meta.url;
StandardSiteUpvote.writer = StandardSiteComments.writer = new Writer(clientConfig(here));

if (!customElements.get('standard-site-upvote')) {
	customElements.define('standard-site-upvote', StandardSiteUpvote);
}
if (!customElements.get('standard-site-comments')) {
	customElements.define('standard-site-comments', StandardSiteComments);
}
