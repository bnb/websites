// Lighthouse CI: `npm run lighthouse` builds, then serves the preview on :4174.
module.exports = require('@bnb/testing/lighthouse')({
	port: 4174,
	paths: ['/', '/posts/what-is-the-atmosphere/', '/series/esm-in-node-js/']
});
