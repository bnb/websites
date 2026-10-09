// A static blog: every page is prerendered, and none ships SvelteKit's
// client-side JavaScript, just HTML and CSS. The only scripts are
// standard.site's on posts: the subscribe button, the upvote and the comments.
export const prerender = true;
export const csr = false;
export const trailingSlash = 'always';
