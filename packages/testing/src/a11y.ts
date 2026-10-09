import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** WCAG 2.2 A + AA, plus axe's best practices (landmarks, heading order, …). */
export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

/** Runs axe over the page (or one part of it) and fails with one readable line per violation. */
export async function expectNoViolations(page: Page, include?: string): Promise<void> {
	let builder = new AxeBuilder({ page }).withTags(AXE_TAGS);
	if (include) builder = builder.include(include);
	const { violations } = await builder.analyze();
	const summary = violations.map(
		(v) => `${v.id} (${v.impact}): ${v.help}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`
	);
	expect(summary).toEqual([]);
}
