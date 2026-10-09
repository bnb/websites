import type { Preview } from '@storybook/sveltekit';

// Every face any theme uses, self-hosted like on the sites.
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource/archivo-black/400.css';
import '@fontsource/dm-mono/400.css';
import '@fontsource/dm-mono/400-italic.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';

import '@bnb/ui/base.css';
import '@bnb/ui/themes/bnb.css';
import '@bnb/ui/themes/camera.css';
import '@bnb/ui/themes/dj.css';

/** A theme, and the site whose stylesheet goes with it. */
const THEMES = {
	bnb: 'bnb.im',
	camera: 'tierney.camera',
	dj: 'tierneycyren.com'
} as const;

type Theme = keyof typeof THEMES;

// Each site's global stylesheet (app.css), as text, so only the current
// theme's is on the page: they all style body, links and focus differently.
// (Eager: Storybook's dev server serves a lazily imported ?inline stylesheet
// as plain CSS rather than a module.)
const siteStyles = import.meta.glob<string>('../../*/src/app.css', {
	query: '?inline',
	import: 'default',
	eager: true
});

function siteStyle(): HTMLStyleElement {
	let style = document.querySelector<HTMLStyleElement>('style[data-site]');
	if (!style) {
		style = document.createElement('style');
		style.dataset.site = '';
		document.head.append(style);
	}
	return style;
}

const preview: Preview = {
	globalTypes: {
		theme: {
			description: 'Which site the shared components are dressed as',
			toolbar: {
				title: 'Theme',
				icon: 'paintbrush',
				items: Object.entries(THEMES).map(([value, title]) => ({ value, title })),
				dynamicTitle: true
			}
		}
	},
	initialGlobals: { theme: 'camera' },

	// A site's own stories pin their theme (parameters.theme); the design
	// system's follow the toolbar, or pin one per story with `globals`.
	beforeEach({ parameters, globals }) {
		const theme = ((parameters.theme as Theme | undefined) ?? globals.theme) as Theme;
		document.documentElement.dataset.theme = theme;
		siteStyle().textContent = siteStyles[`../../${THEMES[theme]}/src/app.css`] ?? '';
	},

	parameters: {
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/i
			}
		},
		a11y: {
			// every story is also an accessibility test: axe violations fail the
			// story's Vitest run (npm run test:storybook) and show in the a11y panel
			test: 'error'
		}
	}
};

export default preview;
