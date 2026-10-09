/**
 * The DID of the reader who last signed in on this site, kept in localStorage
 * under `key`, so a returning reader's session can be restored. Storage that's
 * blocked (private browsing) reads as nobody and forgets quietly.
 */
export function rememberDid(key: string) {
	return {
		get(): string | null {
			try {
				return window.localStorage.getItem(key);
			} catch {
				return null;
			}
		},
		set(did: string) {
			try {
				window.localStorage.setItem(key, did);
			} catch {
				// they'll be asked for their handle next time
			}
		},
		clear() {
			try {
				window.localStorage.removeItem(key);
			} catch {
				// nothing was kept
			}
		}
	};
}
