import { onTestFinished } from 'vitest';

/**
 * Stops the page navigating away (it would take the test with it) and
 * collects where it tried to go instead, until the test finishes.
 */
export function interceptNavigation() {
	const destinations: string[] = [];
	const { navigation } = globalThis as unknown as { navigation: EventTarget };
	const listener = (event: Event) => {
		destinations.push((event as Event & { destination: { url: string } }).destination.url);
		event.preventDefault();
	};
	navigation.addEventListener('navigate', listener);
	onTestFinished(() => navigation.removeEventListener('navigate', listener));
	return destinations;
}
