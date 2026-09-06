import { expect, test } from '@playwright/test';

test('boots and shows the cat selection screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '2D猫えらび' })).toBeVisible();
});
