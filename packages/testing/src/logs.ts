import { initLogger, type WideEvent } from 'evlog';

/**
 * Sends everything evlog emits from here on into the returned array instead of
 * the console, so a test can assert on what was logged.
 */
export function captureLogs({ service = 'test' }: { service?: string } = {}): WideEvent[] {
	const events: WideEvent[] = [];
	initLogger({
		env: { service },
		silent: true,
		drain: ({ event }) => {
			events.push(event);
		}
	});
	return events;
}
