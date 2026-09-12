import { expect, test } from '@playwright/test';
import { openApp } from './helpers';

async function startFirstCatPatrol(page: import('@playwright/test').Page) {
  await openApp(page);
  await page.locator('.cat-item:not(.cat-item--locked)').first().click();
  await page.getByRole('button', { name: 'このねこでみまわりスタート' }).click();
  await expect(page.locator('.scene-canvas')).toHaveAttribute('data-ready', 'true', {
    timeout: 20_000
  });
}

test('desktop patrol uses Shift to dash and hides the dash button', async ({ page }) => {
  await startFirstCatPatrol(page);

  await expect(page.getByText('Shift ではしる')).toBeVisible();
  await expect(page.getByRole('button', { name: 'はしる' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'てんけんする' })).toBeVisible();
});

test('touch patrol shows a hold dash button at the bottom left', async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 }
  });
  const page = await context.newPage();
  await startFirstCatPatrol(page);
  await page.locator('.scene-canvas').tap();

  const dash = page.getByRole('button', { name: 'はしる' });
  const inspect = page.getByRole('button', { name: 'てんけんする' });
  await expect(dash).toBeVisible();
  await expect(page.getByText('おしたまま うごく')).toBeVisible();
  await expect(page.getByText('Shift ではしる')).toHaveCount(0);

  const dashBox = await dash.boundingBox();
  const inspectBox = await inspect.boundingBox();
  expect(dashBox).toBeTruthy();
  expect(inspectBox).toBeTruthy();
  if (dashBox && inspectBox) {
    expect(dashBox.x).toBeLessThan(inspectBox.x);
    expect(Math.abs(dashBox.y - inspectBox.y)).toBeLessThan(24);
  }

  await context.close();
});
