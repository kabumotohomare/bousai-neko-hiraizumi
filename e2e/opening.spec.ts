import { expect, test } from '@playwright/test';
import { dismissOpening } from './helpers';

test('shows the opening video before cat selection', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'ぼうさいネコ＠平泉' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'はじめる' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'スキップ' })).toBeVisible();
  await expect(page.getByRole('button', { name: '猫をえらぶ' })).toHaveCount(0);
  await expect(page.locator('.opening__video')).toHaveAttribute('src', '/op/op.mp4');
  await expect(page.getByRole('heading', { name: '猫をえらぶ' })).toHaveCount(0);

  expect((await page.request.get('/op/op.mp4')).ok()).toBeTruthy();
  expect((await page.request.get('/op/bgm.m4a')).ok()).toBeTruthy();
});

test('skipping the opening reaches the cat selection screen', async ({ page }) => {
  await page.goto('/');
  await dismissOpening(page);
  await expect(page.getByRole('heading', { name: '猫をえらぶ' })).toBeVisible();
});

test('starting keeps video and BGM looping together on the OP', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'はじめる' }).click();

  await expect(page.getByRole('button', { name: 'はじめる' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '猫をえらぶ' })).toHaveCount(0);
  // まだ OP に留まる
  await expect(page.getByRole('heading', { name: '猫をえらぶ' })).toHaveCount(0);
  await expect(page.locator('.opening__video')).toBeVisible();

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const video = document.querySelector('.opening__video') as HTMLVideoElement | null;
        const bgm = (window as Window & { __bousaiBgm?: HTMLAudioElement }).__bousaiBgm;
        return {
          videoPlaying: Boolean(video && !video.paused && video.loop),
          bgmPlaying: Boolean(bgm && !bgm.paused && bgm.loop)
        };
      })
    )
    .toEqual({ videoPlaying: true, bgmPlaying: true });

  await page.getByRole('button', { name: 'スキップ' }).click();
  await expect(page.getByRole('heading', { name: '猫をえらぶ' })).toBeVisible();

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const bgm = (window as Window & { __bousaiBgm?: HTMLAudioElement }).__bousaiBgm;
        return Boolean(bgm && !bgm.paused);
      })
    )
    .toBe(true);
});
