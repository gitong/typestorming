import { test, expect } from '@playwright/test';
import { freshPage, nodes, edges } from './helpers.js';

test.describe('Feature 1: Markdown Rendering', () => {
  test('renders nodes from localStorage markdown on load', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('typestorming-data', `## Nodes
A[#Alpha; First node]
B[#Beta; Second node]

## Relationships
A --> B`);
    });
    await page.reload();
    await page.waitForSelector('#canvas-container svg');

    await expect(nodes(page)).toHaveCount(2);
  });

  test('renders edges between nodes', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('typestorming-data', `## Nodes
A[#Alpha; First node]
B[#Beta; Second node]

## Relationships
A --> B`);
    });
    await page.reload();
    await page.waitForSelector('#canvas-container svg');

    // At least one edge path should exist
    const edgeCount = await page.locator('#canvas-container svg path').count();
    expect(edgeCount).toBeGreaterThan(0);
  });

  test('shows node title text on canvas', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('typestorming-data', `## Nodes
A[#Hello World; Some body]

## Relationships`);
    });
    await page.reload();
    await page.waitForSelector('#canvas-container svg');

    await expect(page.locator('#canvas-container svg .node-title').first()).toBeVisible();
  });

  test('re-renders when markdown editor is updated', async ({ page }) => {
    await freshPage(page);

    // Switch to editor view and set known content
    await page.keyboard.press('Control+m');
    await page.waitForSelector('#markdown-editor');
    await page.locator('#markdown-editor').fill(`## Nodes
X[#ExtraNode; added via editor]

## Relationships`);

    // Switch back to canvas
    await page.keyboard.press('Control+m');
    await page.waitForSelector('#canvas-container svg');

    await expect(nodes(page)).toHaveCount(1);
  });
});
