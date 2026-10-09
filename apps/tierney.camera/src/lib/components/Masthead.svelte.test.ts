import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import type { Profile } from '../types';
import Masthead from './Masthead.svelte';

describe('Masthead (component)', () => {
	it('renders the profile name and first line of the bio', async () => {
		const profile: Profile = {
			displayName: 'tierney cyren',
			description: 'girl rave dj. photographer.\nnyc.',
			avatarCid: null
		};
		render(Masthead, { profile });

		await expect
			.element(page.getByRole('heading', { level: 1 }))
			.toHaveTextContent('tierney cyren');
		await expect.element(page.getByText('girl rave dj. photographer.')).toBeInTheDocument();
	});

	it('falls back gracefully with no profile', async () => {
		render(Masthead, { profile: null });
		await expect
			.element(page.getByRole('heading', { level: 1 }))
			.toHaveTextContent('tierney cyren');
	});
});
