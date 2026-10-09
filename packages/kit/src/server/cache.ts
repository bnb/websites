// A tiny stale-while-revalidate cache for a single async value.
//
// - fresh (younger than `freshMs`): served from memory
// - stale: served from memory immediately while one background refresh runs
// - nothing cached yet: callers wait for the load (concurrent callers share it)
// - a failed refresh keeps serving the last good value
//
// It keeps the AT Protocol off the hot path of every request, and keeps a site
// up through a PDS blip after the first successful load.

export interface SwrCache<T> {
	get(): Promise<T>;
}

export function swrCache<T>(
	load: () => Promise<T>,
	{
		freshMs,
		now = Date.now,
		onError = () => {}
	}: { freshMs: number; now?: () => number; onError?: (error: unknown) => void }
): SwrCache<T> {
	let value: { data: T; at: number } | undefined;
	let inflight: Promise<T> | undefined;

	function refresh(): Promise<T> {
		inflight ??= load()
			.then((data) => {
				value = { data, at: now() };
				return data;
			})
			.finally(() => {
				inflight = undefined;
			});
		return inflight;
	}

	return {
		async get() {
			if (!value) return refresh();
			if (now() - value.at >= freshMs) {
				refresh().catch(onError);
			}
			return value.data;
		}
	};
}
