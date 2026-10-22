import { devices, type Project } from '@playwright/test';

// Every site's Playwright projects. Pull requests run chromium (`--project chromium`); the weekly
// scheduled workflow runs all three.
export const projects: Project[] = [
	{ name: 'chromium', use: { ...devices['Desktop Chrome'] } },
	{ name: 'firefox', use: { ...devices['Desktop Firefox'] } },
	{ name: 'webkit', use: { ...devices['Desktop Safari'] } }
];
