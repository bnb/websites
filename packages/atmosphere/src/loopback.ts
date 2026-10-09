import { LOOPBACK_HOSTS } from './site';

/** Whether the page is on a local dev address, where sign-in uses a loopback client. */
export const isLoopback = () => LOOPBACK_HOSTS.includes(window.location.hostname);

/**
 * The OAuth callback lands on 127.0.0.1, and sign-in state is kept per origin,
 * so local dev has to start there too: on another loopback name, this moves
 * the page there and returns true (the page is leaving; do nothing else).
 */
export function moveToLoopback(): boolean {
	const { hostname } = window.location;
	if (!LOOPBACK_HOSTS.includes(hostname) || hostname === LOOPBACK_HOSTS[0]) return false;
	window.location.hostname = LOOPBACK_HOSTS[0];
	return true;
}
