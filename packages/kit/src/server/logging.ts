import type { Handle, HandleServerError, RequestEvent } from '@sveltejs/kit';
import { initLogger, type RequestLogger } from 'evlog';
import { createFsDrain } from 'evlog/fs';
import { createEvlogHooks } from 'evlog/sveltekit';

declare global {
	namespace App {
		interface Locals {
			/** This request's wide event (see requestLogging). */
			log: RequestLogger;
		}
	}
}

/**
 * evlog's SvelteKit hooks around `handle`: one wide event per request (method,
 * path, status, duration, plus whatever handlers add through `locals.log`),
 * with server errors recorded on it. A 404 is just its status, so scanners
 * don't fill the log with stack traces. Production prints JSON lines for the
 * host to collect, redacted; `vite dev` prints them pretty and also writes
 * them to .evlog/logs. The health check is left out, since the host polls it.
 *
 * Production is decided by `dev` rather than evlog's NODE_ENV check, since
 * adapter-node's server doesn't set NODE_ENV.
 */
export function requestLogging({
	service,
	dev,
	handle
}: {
	service: string;
	dev: boolean;
	handle: Handle;
}): { handle: Handle; handleError: HandleServerError } {
	initLogger({
		env: { service, environment: dev ? 'development' : 'production' },
		pretty: dev,
		redact: !dev,
		drain: dev ? createFsDrain() : undefined
	});
	const hooks = createEvlogHooks({ exclude: ['/healthz'] });
	return {
		handle: ({ event, resolve }) =>
			hooks.handle({ event, resolve: (inner: RequestEvent) => handle({ event: inner, resolve }) }),
		handleError: (input) => (input.status < 500 ? undefined : hooks.handleError(input))
	};
}

/** A request logger's `error()` takes an Error, so anything else that was thrown is wrapped in one. */
export const asError = (thrown: unknown): Error =>
	thrown instanceof Error ? thrown : new Error(String(thrown));
