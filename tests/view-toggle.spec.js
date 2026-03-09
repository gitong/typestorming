import { test, expect } from '@playwright/test';
import { freshPage } from './helpers.js';

test.describe('Feature 7: Canvas ↔ Markdown View Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await freshPage(page);
  });

  test('Ctrl+M switches to Markdown editor view', async ({ page }) => {
    await expect(page.locator('#canvas-container')).toBeVisible();
    await page.keyboard.press('Control+m');
    await expect(page.locator('#editor-container')).toBeVisible();
  });

  test('Ctrl+M switches back to Canvas view', async ({ page }) => {
    await page.keyboard.press('Control+m');
    await expect(page.locator('#editor-container')).toBeVisible();

    await page.keyboard.press('Control+m');
    await expect(page.locator('#canvas-container')).toBeVisible();
  });

  test('edits in Markdown editor reflect on canvas after switching back', async ({ page }) => {
    await page.keyboard.press('Control+m');
    await page.waitForSelector('#markdown-editor');

    await page.locator('#markdown-editor').fill(`## Nodes
Z[#Zebra; from editor]

## Relationships`);

    await page.keyboard.press('Control+m');
    await page.waitForSelector('#canvas-container svg');

    await expect(page.locator('#canvas-container svg').getByText('Zebra')).toBeVisible();
  });
});
