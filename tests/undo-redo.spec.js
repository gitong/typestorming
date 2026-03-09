import { test, expect } from '@playwright/test';
import { freshPage, nodes, clickFirstNode } from './helpers.js';

test.describe('Feature 2: Undo / Redo', () => {
  test.beforeEach(async ({ page }) => {
    await freshPage(page);
  });

  test('Ctrl+Z undoes node creation', async ({ page }) => {
    const before = await nodes(page).count();
    await clickFirstNode(page);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape'); // cancel edit

    await expect(nodes(page)).toHaveCount(before + 1);

    // _cancelEdit pushes an extra undo entry (updateNode), so two Ctrl+Z needed
    // to reach back before the addNode
    await page.keyboard.press('Control+z'); // undoes the cancel's updateNode
    await page.keyboard.press('Control+z'); // undoes the addNode
    await expect(nodes(page)).toHaveCount(before);
  });

  test('Ctrl+Y redoes undone node creation', async ({ page }) => {
    const before = await nodes(page).count();
    await clickFirstNode(page);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');

    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+z');
    await expect(nodes(page)).toHaveCount(before);

    await page.keyboard.press('Control+y');
    await expect(nodes(page)).toHaveCount(before + 1);
  });

  test('Ctrl+Z undoes node deletion', async ({ page }) => {
    const before = await nodes(page).count();
    await clickFirstNode(page);
    await page.keyboard.press('Delete');

    await expect(nodes(page)).toHaveCount(before - 1);

    await page.keyboard.press('Control+z');
    await expect(nodes(page)).toHaveCount(before);
  });
});
