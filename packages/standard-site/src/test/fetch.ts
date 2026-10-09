// Stand-ins for the network: every test that fetches answers from these.
import { vi } from 'vitest';

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
	new Response(JSON.stringify(body), { status, headers });

export interface Call {
	url: URL;
	init: RequestInit & { headers?: Record<string, string> };
}

/** Answers each fetch with the next response, and keeps what was asked for. */
export function fetchSequence(...responses: Response[]) {
	const calls: Call[] = [];
	vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init = {}) => {
		calls.push({ url: new URL(String(input)), init: init as Call['init'] });
		const response = responses.shift();
		if (!response) throw new Error(`unexpected fetch ${String(input)}`);
		return response;
	});
	return calls;
}
