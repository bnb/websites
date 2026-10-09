// Lighthouse CI, shared by every site's lighthouserc.cjs. Each site runs it with
// `npm run lighthouse` (builds first, then serves the preview on its own port).
// Uses CHROME_PATH if set, otherwise the Chromium that Playwright installs
// (`npx playwright install chromium`), so no separate Chrome is needed.

/**
 * @param {{ port: number, paths?: string[], maxWaitForLoad?: number }} options
 */
module.exports = function lighthouseConfig({ port, paths = ['/'], maxWaitForLoad = 45000 }) {
	const chromePath = process.env.CHROME_PATH || require('playwright').chromium.executablePath();
	return {
		ci: {
			collect: {
				startServerCommand: 'npm run preview',
				startServerReadyPattern: 'Local:',
				startServerReadyTimeout: 60000,
				url: paths.map((path) => `http://localhost:${port}${path}`),
				numberOfRuns: 3,
				chromePath,
				settings: {
					chromeFlags: '--headless=new',
					// the live sites read from the AT Protocol, so give the network a moment
					maxWaitForLoad
				}
			},
			// Budget on the four category scores. The strict `lighthouse:no-pwa` preset
			// isn't used because several of its per-audit rules (next-gen image formats,
			// cache TTL) are governed by external image CDNs, not by the sites.
			// Accessibility and SEO are fully in the sites' hands, so anything short of
			// 100 fails; axe (e2e) covers the WCAG 2.2 AA rules Lighthouse doesn't run.
			assert: {
				assertions: {
					'categories:performance': ['warn', { minScore: 0.85 }],
					'categories:accessibility': ['error', { minScore: 1 }],
					'categories:best-practices': ['warn', { minScore: 0.9 }],
					'categories:seo': ['error', { minScore: 1 }]
				}
			},
			upload: {
				target: 'filesystem',
				outputDir: './lighthouse-report'
			}
		}
	};
};
