/** A single record as returned by com.atproto.repo.listRecords. */
export interface AtpRecord<T = unknown> {
	uri: string;
	cid: string;
	value: T;
}

export interface BlobRef {
	$type: 'blob';
	ref: { $link: string };
	mimeType: string;
	size: number;
}
