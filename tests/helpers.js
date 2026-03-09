/**
 * Shared helpers for Typestorming Playwright tests.
 * The app stores its graph in localStorage under the key 'typestorming-data'.
 */

/** Clear localStorage and reload so every test starts from a blank canvas. */
export async function freshPage(page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('typestorming-data'));
  await page.reload();
  // Wait for the SVG canvas to be present
  await page.waitForSelector('#canvas-container svg');
}

/** Return all visible node <g> elements rendered by D3. */
export function nodes(page) {
  return page.locator('#canvas-container svg .node-group');
}

/** Return all visible edge <path> elements rendered by D3. */
export function edges(page) {
  return page.locator('#canvas-container svg .edge-path');
}

/** Click the first node on the canvas. */
export async function clickFirstNode(page) {
  const firstNode = page.locator('#canvas-container svg .node-group').first();
  await firstNode.click();
  return firstNode;
}
