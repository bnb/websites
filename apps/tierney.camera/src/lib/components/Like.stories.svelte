<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { Likes } from '../likes';
	import Like from './Like.svelte';
	import SignIn from './SignIn.svelte';

	const { Story } = defineMeta({
		title: 'tierney.camera/Like',
		component: Like,
		parameters: { theme: 'camera', layout: 'fullscreen' }
	});

	const GALLERY = 'at://did:plc:uashgn65n5z7aqwk5cbuba5c/social.grain.gallery/3mvnxcannmzke';
	const counts = { [GALLERY]: 8 };

	// a reader's likes as the page holds them once their session has restored
	const signedOut = new Likes();
	const liked = new Likes();
	liked.liked.add(GALLERY);
	const failed = new Likes();
	failed.errors.set(GALLERY, "Couldn't save your like.");

	const signIn = () => new Promise<void>(() => {});
</script>

<!-- in a caption, after the exposure, as the gallery and the featured frame show it -->
<Story name="Signed out, with a count">
	{#snippet template()}
		<p class="cap mono">
			<span>50mm ƒ/2.2 1/80 ISO 12800</span>
			<Like subject={GALLERY} label="photograph 03" {counts} store={signedOut} />
		</p>
	{/snippet}
</Story>

<Story name="Liked">
	{#snippet template()}
		<p class="cap mono">
			<span>50mm ƒ/2.2 1/80 ISO 12800</span>
			<Like subject={GALLERY} label="photograph 03" {counts} store={liked} />
		</p>
	{/snippet}
</Story>

<!-- Constellation couldn't count it, or nobody has liked it yet -->
<Story name="No count">
	{#snippet template()}
		<p class="cap mono">
			<span>50mm ƒ/2.2 1/80 ISO 12800</span>
			<Like subject={GALLERY} label="photograph 03" store={signedOut} />
		</p>
	{/snippet}
</Story>

<Story name="Couldn't save">
	{#snippet template()}
		<p class="cap mono tall">
			<span>50mm ƒ/2.2 1/80 ISO 12800</span>
			<Like subject={GALLERY} label="photograph 03" {counts} store={failed} />
		</p>
	{/snippet}
</Story>

<!-- the lightbox's, beside Close -->
<Story name="Large, liked">
	{#snippet template()}
		<p class="bar mono">
			<Like subject={GALLERY} label="photograph 03" {counts} store={liked} large />
		</p>
	{/snippet}
</Story>

<!-- what a signed-out reader gets on their first like -->
<Story name="Sign in">
	{#snippet template()}
		<SignIn onsubmit={signIn} onclose={() => {}} />
	{/snippet}
</Story>

<style>
	.cap {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: 14px;
		padding: 24px;
		background: var(--bg);
		color: var(--ink-dim);
		font-size: 12px;
	}
	.tall {
		padding-bottom: 64px;
	}
	.bar {
		display: flex;
		justify-content: flex-end;
		padding: 4px 24px;
		background: var(--bg);
	}
</style>
