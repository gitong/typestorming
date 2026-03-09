import { test, expect } from '@playwright/test';
import { freshPage, clickFirstNode } from './helpers.js';

test.describe('Feature 2: Inline Editing', () => {
  test.beforeEach(async ({ page }) => {
    await freshPage(page);
  });

  test('Space opens Edit Mode on selected node', async ({ page }) => {
    await clickFirstNode(page);
    await page.keyboard.press(' ');

    await expect(page.locator('#inline-edit-overlay')).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('double-click opens Edit Mode', async ({ page }) => {
    const first = page.locator('#canvas-container svg .node-group').first();
    await first.dblclick();

    await expect(page.locator('#inline-edit-overlay')).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('typing in Edit Mode updates the node title', async ({ page }) => {
    await clickFirstNode(page);
    await page.keyboard.press(' ');

    // Wait for overlay and input to be ready before typing
    await expect(page.locator('#inline-edit-overlay')).toBeVisible();
    await page.locator('#inline-edit-title').fill('My New Title');
    await page.keyboard.press('Enter');
    // May enter Edge Label Mode — press Escape to return to Select
    await page.keyboard.press('Escape');

    // Verify title appears somewhere on canvas via .node-title elements
    await expect(page.locator('#canvas-container svg .node-title').filter({ hasText: 'My New Title' }).first()).toBeVisible();
  });

  test('Escape cancels edit and reverts', async ({ page }) => {
    // Record original title text
    const originalTitle = await page.locator('#canvas-container svg .node-title').first().textContent();

    await clickFirstNode(page);
    await page.keyboard.press(' ');
    await page.keyboard.press('Control+a');
    await page.keyboard.type('Temporary Title That Should Not Persist');
    await page.keyboard.press('Escape');

    // Original title should be restored
    const restoredTitle = await page.locator('#canvas-container svg .node-title').first().textContent();
    expect(restoredTitle).toContain(originalTitle.trim());
  });
});
