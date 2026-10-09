// The parts that touch the page: where it is (local dev or not), and the
// remembered DID, with a stand-in window whose location can be anything.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isLoopback, moveToLoopback } from './loopback';
import { rememberDid } from './storage';

function at(hostname: string) {
	const location = { hostname };
	vi.stubGlobal('window', { location });
	return location;
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('isLoopback', () => {
	it.each([
		['127.0.0.1', true],
		['localhost', true],
		['[::1]', true],
		['tierney.camera', false],
		['127.0.0.1.example.com', false]
	])('is %s for %s', (hostname, loopback) => {
		at(hostname);
		expect(isLoopback()).toBe(loopback);
	});
});

describe('moveToLoopback', () => {
	it.each(['localhost', '[::1]'])('moves %s to 127.0.0.1, where the callback lands', (hostname) => {
		const location = at(hostname);
		expect(moveToLoopback()).toBe(true);
		expect(location.hostname).toBe('127.0.0.1');
	});

	it.each(['127.0.0.1', 'tierney.camera'])('leaves %s where it is', (hostname) => {
		const location = at(hostname);
		expect(moveToLoopback()).toBe(false);
		expect(location.hostname).toBe(hostname);
	});
});

describe('rememberDid', () => {
	function storage() {
		const items = new Map<string, string>();
		const localStorage = {
			getItem: (key: string) => items.get(key) ?? null,
			setItem: (key: string, value: string) => void items.set(key, value),
			removeItem: (key: string) => void items.delete(key)
		};
		vi.stubGlobal('window', { localStorage });
		return { items, localStorage };
	}

	it('keeps the reader’s DID under its key, and forgets it', () => {
		const { items } = storage();
		const remembered = rememberDid('site:did');
		expect(remembered.get()).toBeNull();
		remembered.set('did:plc:reader');
		expect(items).toEqual(new Map([['site:did', 'did:plc:reader']]));
		expect(remembered.get()).toBe('did:plc:reader');
		expect(rememberDid('other:did').get()).toBeNull();
		remembered.clear();
		expect(remembered.get()).toBeNull();
	});

	it('reads as nobody, and forgets quietly, with storage blocked', () => {
		const { localStorage } = storage();
		const blocked = () => {
			throw new DOMException('The operation is insecure.', 'SecurityError');
		};
		Object.assign(localStorage, { getItem: blocked, setItem: blocked, removeItem: blocked });
		const remembered = rememberDid('site:did');
		expect(() => remembered.set('did:plc:reader')).not.toThrow();
		expect(remembered.get()).toBeNull();
		expect(() => remembered.clear()).not.toThrow();
	});
});
