import { test, expect } from '@playwright/test';
import { freshPage, nodes, clickFirstNode } from './helpers.js';

test.describe('Feature 2: Node Creation', () => {
  test.beforeEach(async ({ page }) => {
    await freshPage(page);
  });

  test('Enter creates a sibling node', async ({ page }) => {
    const before = await nodes(page).count();
    await clickFirstNode(page);
    await page.keyboard.press('Enter');
    // Exit edit mode without typing
    await page.keyboard.press('Escape');

    await expect(nodes(page)).toHaveCount(before + 1);
  });

  test('Tab creates a child node', async ({ page }) => {
    const before = await nodes(page).count();
    await clickFirstNode(page);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Escape');

    await expect(nodes(page)).toHaveCount(before + 1);
  });

  test('new node IDs are auto-generated (n1, n2, ...)', async ({ page }) => {
    await clickFirstNode(page);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');

    // Check markdown contains sequential IDs
    await page.keyboard.press('Control+m');
    await page.waitForSelector('#markdown-editor');
    const md = await page.locator('#markdown-editor').inputValue();
    expect(md).toMatch(/n\d+\[/);
  });

  test('Enter enters Edit Mode on the new node', async ({ page }) => {
    await clickFirstNode(page);
    await page.keyboard.press('Enter');

    // Edit overlay or inline edit should be visible
    await expect(page.locator('#inline-edit-overlay')).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('Tab child node is connected to parent by an edge', async ({ page }) => {
    await clickFirstNode(page);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Escape');

    // Check markdown for a relationship
    await page.keyboard.press('Control+m');
    await page.waitForSelector('#markdown-editor');
    const md = await page.locator('#markdown-editor').inputValue();
    expect(md).toMatch(/-->/);
  });
});
