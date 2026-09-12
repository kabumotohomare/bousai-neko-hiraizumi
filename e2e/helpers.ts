import { expect, type Page } from '@playwright/test';

/** OP をスキップして猫えらび画面まで進める。 */
export async function dismissOpening(page: Page) {
  const skip = page.getByRole('button', { name: 'スキップ' });
  const heading = page.getByRole('heading', { name: '猫をえらぶ' });
  await expect(skip.or(heading)).toBeVisible({ timeout: 20_000 });
  if (await skip.isVisible()) {
    await skip.click();
  }
  await expect(heading).toBeVisible();
}

/** 「今日もう帰るにゃ」後のエンディングをスキップして猫えらびへ。 */
export async function dismissEnding(page: Page) {
  const skip = page.getByRole('button', { name: 'スキップ' });
  const heading = page.getByRole('heading', { name: '猫をえらぶ' });
  await expect(skip.or(heading)).toBeVisible({ timeout: 20_000 });
  if (await skip.isVisible()) {
    await skip.click();
  }
  await expect(heading).toBeVisible();
}

export async function openApp(page: Page, path = '/') {
  await page.goto(path);
  await dismissOpening(page);
}
