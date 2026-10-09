import type { StorybookConfig } from '@storybook/sveltekit';

// One styleguide for everything: the foundations (tokens per theme), the shared
// components in @bnb/ui, and each site's own components, all next to their code.
const config: StorybookConfig = {
	stories: [
		'../src/**/*.stories.@(svelte|ts)',
		'../../../packages/ui/src/**/*.stories.svelte',
		'../../bnb.im/src/**/*.stories.svelte',
		'../../tierney.camera/src/**/*.stories.svelte',
		'../../tierneycyren.com/src/**/*.stories.svelte'
	],
	addons: ['@storybook/addon-svelte-csf', '@storybook/addon-a11y', '@storybook/addon-vitest'],
	framework: {
		name: '@storybook/sveltekit',
		options: {}
	}
};

export default config;
