<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, userEvent } from 'storybook/test';
	import SiteRail, { type Latest } from './SiteRail.svelte';

	// The same rail on each site: a strip on top on phones, down the left from
	// 760px. Resize the viewport to see both. Each play function tabs to the
	// next site's link, which (from 760px) opens its preview beside the rail.
	const { Story } = defineMeta({
		title: 'Shared/SiteRail',
		component: SiteRail,
		parameters: { layout: 'fullscreen' }
	});

	const latest: Latest = {
		bnb: {
			kind: 'post',
			title: 'What is the Atmosphere: An Untech Introduction',
			date: '2026-10-02T00:00:00.000Z'
		},
		camera: {
			kind: 'photo',
			image: {
				src: 'https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:uashgn65n5z7aqwk5cbuba5c/bafkreidfcru2lodcgegau3gy3fxtaswms3p7v37ioepfj4r7jkvd6bys24@jpeg',
				alt: 'A Bushwick rooftop at dusk',
				width: 3,
				height: 2
			},
			date: '2026-09-17T20:44:19.147Z'
		},
		dj: { kind: 'mix', title: 'tierney cyren @ tachycardia 028', date: '2026-08-25T23:53:12Z' }
	};
</script>

<Story
	name="bnb.im"
	globals={{ theme: 'bnb' }}
	play={async ({ canvas }) => {
		await expect(canvas.getByRole('link', { name: 'bnb.im' })).toHaveAttribute(
			'aria-current',
			'true'
		);
		await userEvent.tab();
		await userEvent.tab();
		await expect(canvas.getByRole('link', { name: 'tierney.camera' })).toHaveAccessibleDescription(
			'Newest photo: A Bushwick rooftop at dusk, Sep 17, 2026'
		);
	}}
>
	{#snippet template()}
		<SiteRail current="bnb" {latest}><p class="stand-in">The page sits here.</p></SiteRail>
	{/snippet}
</Story>

<Story
	name="tierney.camera"
	globals={{ theme: 'camera' }}
	play={async ({ canvas }) => {
		await userEvent.tab();
		await expect(canvas.getByRole('link', { name: 'bnb.im' })).toHaveAccessibleDescription(
			'Newest post: What is the Atmosphere: An Untech Introduction, Oct 2, 2026'
		);
	}}
>
	{#snippet template()}
		<SiteRail current="camera" {latest}><p class="stand-in">The page sits here.</p></SiteRail>
	{/snippet}
</Story>

<Story
	name="tierneycyren.com"
	globals={{ theme: 'dj' }}
	play={async ({ canvas }) => {
		await userEvent.tab();
		await userEvent.tab();
		await expect(canvas.getByRole('link', { name: 'tierney.camera' })).toHaveAccessibleDescription(
			'Newest photo: A Bushwick rooftop at dusk, Sep 17, 2026'
		);
	}}
>
	{#snippet template()}
		<SiteRail current="dj" {latest}><p class="stand-in">The page sits here.</p></SiteRail>
	{/snippet}
</Story>

<style>
	.stand-in {
		margin: 0;
		padding: 32px;
		min-height: 60vh;
	}
</style>
