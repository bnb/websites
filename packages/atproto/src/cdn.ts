import { DID } from './account';

// Images go through the atproto image CDN (fast, resized). If that ever fails,
// callers fall back to the raw blob straight from the PDS.

const IMG_CDN = 'https://cdn.bsky.app/img';

export function thumbUrl(cid: string, did = DID): string {
	return `${IMG_CDN}/feed_thumbnail/plain/${did}/${cid}@jpeg`;
}

export function fullUrl(cid: string, did = DID): string {
	return `${IMG_CDN}/feed_fullsize/plain/${did}/${cid}@jpeg`;
}

export function blobUrl(pds: string, cid: string, did = DID): string {
	return `${pds}/xrpc/com.atproto.sync.getBlob?did=${did}&cid=${cid}`;
}
