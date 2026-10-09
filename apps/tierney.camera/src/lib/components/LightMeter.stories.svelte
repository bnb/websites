<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import LightMeter from './LightMeter.svelte';

	const { Story } = defineMeta({
		title: 'tierney.camera/LightMeter',
		component: LightMeter,
		parameters: { theme: 'camera' }
	});
</script>

<!-- ƒ/1.4, 1/30 s, ISO 2000: a club floor -->
<Story name="Low light" args={{ ev: 1.56 }} />

<!-- ƒ/8, 1/250 s, ISO 100: an overcast street -->
<Story name="Daylight" args={{ ev: 13.97 }} />

<!-- ƒ/1.4, 4 s, ISO 6400: darker than the scale, so the needle pins at its end -->
<Story name="Off the scale" args={{ ev: -7.03 }} />
