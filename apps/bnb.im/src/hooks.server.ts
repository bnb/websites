import { securityHeaders } from '@bnb/kit/server';

// Prerendering runs every page through this, so the Latin cut of Archivo Black
// (the masthead's face) is preloaded in the static HTML. The headers only
// matter for `vite dev` / `vite preview`: GitHub Pages serves the files.
export const handle = securityHeaders({
	preloadFont: (path) => path.includes('archivo-black-latin-400')
});
