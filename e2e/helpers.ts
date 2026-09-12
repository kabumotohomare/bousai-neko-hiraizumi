import { Page } from '@playwright/test';

/**
 * みまわり開始時の「3, 2, 1, スタート！」カウントダウン(feature-9.3)が
 * 消えるまで待つ。この間はプレイヤー入力が無視されるため、
 * .scene-canvas[data-ready="true"] の直後に移動キーを押すテストは
 * このカウントダウン分(最大 3.6 秒程度)を待たないと動かない。
 */
export async function waitForCountdownToFinish(page: Page): Promise<void> {
  await page.waitForSelector('.patrol-countdown', { state: 'detached', timeout: 10_000 });
}
