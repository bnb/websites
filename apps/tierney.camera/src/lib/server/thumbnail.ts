import { fetchWithTimeout } from '@bnb/kit/server';
import { thumbUrl } from '../atproto';
import { REQUEST_TIMEOUT_MS } from './portfolio';

/**
 * A photograph's CDN thumbnail, as JPEG bytes. Image work happens on the
 * server because the CDN sends no CORS headers, so a page can't read pixels.
 */
export async function thumbnail(cid: string): Promise<Buffer> {
	const response = await fetchWithTimeout(REQUEST_TIMEOUT_MS)(thumbUrl(cid));
	if (!response.ok) throw new Error(`The image CDN answered ${response.status} for ${cid}`);
	return Buffer.from(await response.arrayBuffer());
}
