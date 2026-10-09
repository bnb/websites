import type { Attachment } from 'svelte/attachments';

// Images that survive a bad CDN. tierney.camera loads atproto CDN thumbnails
// (~1000px, fast and reliable) and sharpens them only where the screen needs
// more pixels; the CDN's full-size preset can time out (504) for photos it
// hasn't rendered before, so it's never on the critical path: a sharper source
// is swapped in only once it has fully loaded. tierneycyren.com loads resized
// covers and falls back to the originals.

/**
 * Keeps an <img> alive when a source fails: on each error it moves to the next
 * url in `fallbacks`, and it calls `onready` once something has loaded. It also
 * catches loads and failures that happened before hydration, which never reach an
 * onload/onerror handler on a server-rendered image.
 */
export function resilient(fallbacks: string[], onready?: () => void): Attachment<HTMLImageElement> {
	const ready = () => onready?.();
	return (img) => {
		let next = 0;
		const fail = () => {
			const url = fallbacks[next++];
			if (!url) return;
			// a srcset would win over the fallback src
			img.removeAttribute('srcset');
			img.src = url;
		};

		// currentSrc is empty for lazy images that haven't started loading yet
		if (img.complete && img.currentSrc) {
			if (img.naturalWidth > 0) ready();
			else fail();
		}

		img.addEventListener('error', fail);
		img.addEventListener('load', ready);
		return () => {
			img.removeEventListener('error', fail);
			img.removeEventListener('load', ready);
		};
	};
}

function preload(url: string): Promise<boolean> {
	const probe = new Image();
	probe.src = url;
	return probe.decode().then(
		() => true,
		() => false
	);
}

/**
 * Once the image has loaded, and only if it's drawn larger than its pixels allow
 * on this screen, quietly fetch the `candidates` in order and swap in the first
 * one that loads.
 */
export function sharpen(candidates: string[]): Attachment<HTMLImageElement> {
	return (img) => {
		let cancelled = false;

		const start = async () => {
			img.removeEventListener('load', start);
			if (img.clientWidth * devicePixelRatio <= img.naturalWidth) return;
			for (const url of candidates) {
				if (cancelled) return;
				if (await preload(url)) {
					if (!cancelled) img.src = url;
					return;
				}
			}
		};

		if (img.complete && img.naturalWidth > 0) void start();
		else img.addEventListener('load', start);

		return () => {
			cancelled = true;
			img.removeEventListener('load', start);
		};
	};
}
