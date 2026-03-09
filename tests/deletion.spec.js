import { test, expect } from '@playwright/test';
import { freshPage, nodes, clickFirstNode } from './helpers.js';

test.describe('Feature 6: Node Deletion', () => {
  test.beforeEach(async ({ page }) => {
    await freshPage(page);
  });

  test('Delete key removes the selected node', async ({ page }) => {
    const before = await nodes(page).count();
    await clickFirstNode(page);
    await page.keyboard.press('Delete');

    await expect(nodes(page)).toHaveCount(before - 1);
  });

  test('Backspace key removes the selected node', async ({ page }) => {
    const before = await nodes(page).count();
    await clickFirstNode(page);
    await page.keyboard.press('Backspace');

    await expect(nodes(page)).toHaveCount(before - 1);
  });

  test('deleting a node removes its relationships from markdown', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('typestorming-data', `## Nodes
A[#Alpha; node]
B[#Beta; node]

## Relationships
A --> B`);
    });
    await page.reload();
    await page.waitForSelector('#canvas-container svg');

    // Select and delete node A
    await page.locator('#canvas-container svg .node-group').first().click();
    await page.keyboard.press('Delete');

    // Check markdown no longer references the deleted node's edge
    await page.keyboard.press('Control+m');
    await page.waitForSelector('#markdown-editor');
    const md = await page.locator('#markdown-editor').inputValue();

    // Only one node should remain and no A --> B edge
    expect(md).not.toMatch(/A --> B/);
  });
});
