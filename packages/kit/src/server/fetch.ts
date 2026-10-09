/** `fetch`, aborted (headers and body) once `ms` have passed. */
export function fetchWithTimeout(ms: number, fetchFn: typeof fetch = fetch): typeof fetch {
	return (input, init) => fetchFn(input, { ...init, signal: AbortSignal.timeout(ms) });
}
