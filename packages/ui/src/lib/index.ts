// The shared design system. Components read the theme tokens a site selects
// with <html data-theme="…"> (themes/*.css); base.css is the common ground.
export { default as BigName } from './BigName.svelte';
export { default as Fact } from './Fact.svelte';
export { default as HeadTags, type HeadTag } from './HeadTags.svelte';
export { default as Facts } from './Facts.svelte';
export { default as Marquee } from './Marquee.svelte';
export { default as Seo } from './Seo.svelte';
export { default as Signoff } from './Signoff.svelte';
export { default as SiteRail } from './SiteRail.svelte';
export { default as SkipLink } from './SkipLink.svelte';
export { resilient, sharpen } from './image';
