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

/**
 * みまわり開始時の「3, 2, 1, スタート！」カウントダウン(feature-9.3)が
 * 消えるまで待つ。この間はプレイヤー入力が無視されるため、
 * .scene-canvas[data-ready="true"] の直後に移動キーを押すテストは
 * このカウントダウン分(最大 3.6 秒程度)を待たないと動かない。
 */
export async function waitForCountdownToFinish(page: Page): Promise<void> {
  await page.waitForSelector('.patrol-countdown', { state: 'detached', timeout: 10_000 });
}
