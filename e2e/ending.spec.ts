import { expect, test } from '@playwright/test';
import { dismissEnding, openApp } from './helpers';

test('leaving the result screen shows ending video with BGM', async ({ page }) => {
  await page.route('**/data/game-config.json', async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    await route.fulfill({ response, json: { ...json, gameDurationSec: 8 } });
  });

  await openApp(page);
  await page.locator('.cat-item:not(.cat-item--locked)').first().click();
  await page.getByRole('button', { name: 'このねこでみまわりスタート' }).click();
  await page.waitForSelector('text=みまわりの 結果', { timeout: 45_000 });
  for (let i = 0; i < 3; i += 1) {
    await page.getByRole('button', { name: 'つぎへ' }).click();
  }

  await page.getByRole('button', { name: '今日もう帰るにゃ' }).click();

  await expect(page.locator('.ending .opening__video')).toHaveAttribute('src', '/op/ending.mp4');
  await expect(page.getByRole('button', { name: 'スキップ' })).toBeVisible();
  expect((await page.request.get('/op/ending.mp4')).ok()).toBeTruthy();
  expect((await page.request.get('/op/ending-bgm.m4a')).ok()).toBeTruthy();

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const video = document.querySelector('.ending .opening__video') as HTMLVideoElement | null;
        const bgm = (window as Window & { __bousaiEndingBgm?: HTMLAudioElement }).__bousaiEndingBgm;
        return {
          videoPlaying: Boolean(video && !video.paused && video.loop),
          bgmPlaying: Boolean(bgm && !bgm.paused && bgm.loop)
        };
      })
    )
    .toEqual({ videoPlaying: true, bgmPlaying: true });

  await dismissEnding(page);
  await expect(page.getByRole('heading', { name: '猫をえらぶ' })).toBeVisible();
});
