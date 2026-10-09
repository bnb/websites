import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import LightMeter from './LightMeter.svelte';

async function meter(ev: number) {
	const view = await render(LightMeter, { ev });
	const needle = view.container.querySelector<SVGLineElement>('.needle')!;
	return { ...view, needle };
}

describe('LightMeter (component)', () => {
	it('reads out the scene brightness, for eyes and for assistive tech', async () => {
		await meter(1.556);

		const reading = page.getByRole('meter', { name: 'Light meter' });
		await expect.element(reading).toHaveAttribute('aria-valuenow', '1.556');
		await expect.element(reading).toHaveAttribute('aria-valuemin', '-2');
		await expect.element(reading).toHaveAttribute('aria-valuemax', '16');
		await expect.element(reading).toHaveAttribute('aria-valuetext', 'EV 1.6, low light');
		await expect.element(page.getByText('EV 1.6')).toBeVisible();
		// the acid band isn't the only sign of a dim scene
		await expect.element(page.getByText('Low light')).toBeVisible();
	});

	it('says nothing about low light for a bright scene', async () => {
		await meter(14.64);
		await expect.element(page.getByRole('meter')).toHaveAttribute('aria-valuetext', 'EV 14.6');
		await expect.element(page.getByText('Low light')).not.toBeInTheDocument();
	});

	it('swings the needle up from the bottom of the scale to its reading', async () => {
		const { needle } = await meter(1.6);
		// −2 to 16 spans 100°, upright at EV 7: EV 1.6 sits 30° left of upright
		await expect.poll(() => needle.style.transform).toBe('rotate(-30deg)');
	});

	it('pins the needle at the end of the scale for a scene off it, but reads the real value', async () => {
		const { needle } = await meter(-7.03);
		await expect.poll(() => needle.style.transform).toBe('rotate(-50deg)');
		const reading = page.getByRole('meter');
		await expect.element(reading).toHaveAttribute('aria-valuenow', '-2');
		await expect.element(reading).toHaveAttribute('aria-valuetext', 'EV -7.0, low light');
	});

	it('labels every other stop, spaced to scale either side of EV 7', async () => {
		const { container } = await meter(7);
		const labels = [...container.querySelectorAll('text')];
		expect(labels.map((label) => label.textContent)).toEqual([
			'−2',
			'0',
			'2',
			'4',
			'6',
			'8',
			'10',
			'12',
			'14',
			'16'
		]);
		const x = (text: string) =>
			Number(labels.find((label) => label.textContent === text)?.getAttribute('x'));
		expect(x('−2') + x('16')).toBeCloseTo(200);
		expect(x('6') + x('8')).toBeCloseTo(200);
		expect(container.querySelectorAll('line:not(.needle):not(.sill)')).toHaveLength(19);
	});
});
