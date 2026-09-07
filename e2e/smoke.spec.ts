import { expect, test } from '@playwright/test';

test('boots and shows the cat selection screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '猫をえらぶ' })).toBeVisible();
});

test('shows the Leaflet map with a pin per cat', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('.leaflet-tile-loaded').first()).toBeVisible();
  await expect(page.locator('.cat-pin')).toHaveCount(2);
  await expect(page.locator('path.leaflet-interactive')).toHaveCount(2);
});

test('the selection map cannot zoom out past Hiraizumi', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.locator('.leaflet-tile-loaded').first()).toBeVisible();
  await expect(page.locator('.cat-pin')).toHaveCount(2);

  const zoomOut = page.locator('.leaflet-control-zoom-out');
  for (let i = 0; i < 12; i += 1) {
    if (await zoomOut.getAttribute('class').then((value) => value?.includes('leaflet-disabled'))) {
      break;
    }
    await zoomOut.click();
  }

  await expect(zoomOut).toHaveClass(/leaflet-disabled/);
  await expect(page.locator('.leaflet-control-zoom-in')).not.toHaveClass(/leaflet-disabled/);
  await expect(page.locator('.cat-pin')).toHaveCount(2);
});

test('selecting a cat on the map enables the start button', async ({ page }) => {
  await page.goto('/');

  const start = page.getByRole('button', { name: 'このねこでみまわりスタート' });
  await expect(start).toBeDisabled();

  await page.locator('.cat-pin', { hasText: 'シラヤマ' }).click();

  await expect(page.locator('.cat-pin--selected')).toHaveCount(1);
  await expect(start).toBeEnabled();
});

test('starting a patrol shows the new screen from the top', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 720 });
  await page.goto('/');

  await page.locator('.cat-item').first().click();

  const start = page.getByRole('button', { name: 'このねこでみまわりスタート' });
  await start.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  await start.click();

  await expect(page.getByText(/残り \d+s/)).toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test('patrol overlay is ready for movement', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('.cat-item').first().click();
  await page.getByRole('button', { name: 'このねこでみまわりスタート' }).click();

  await expect(page.locator('.scene-canvas')).toHaveAttribute('data-ready', 'true', {
    timeout: 10_000
  });
  await expect(page.locator('.scene-canvas canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'てんけんする' })).toBeVisible();
  await expect(page.locator('.virtual-stick')).toBeVisible();
  await expect(page.getByRole('button', { name: '× やめる' })).toBeVisible();
  await expect(page.locator('.patrol-minimap')).toBeVisible();
  await expect(page.locator('.patrol-minimap .leaflet-tile-loaded').first()).toBeVisible();
  await expect(page.locator('.minimap-player__arrow')).toBeVisible();

  const minimap = page.locator('.patrol-minimap');
  const beforeLat = await minimap.getAttribute('data-player-lat');
  expect(beforeLat).toBeTruthy();
  await page.keyboard.down('w');
  await expect.poll(async () => minimap.getAttribute('data-player-lat')).not.toBe(beforeLat);
  await page.keyboard.up('w');
});
