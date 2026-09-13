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

test('starting plays the opening once with BGM', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'はじめる' }).click();

  await expect(page.getByRole('button', { name: 'はじめる' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '猫をえらぶ' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '猫をえらぶ' })).toHaveCount(0);
  await expect(page.locator('.opening__video')).toBeVisible();
  await expect(page.getByText('映像がおわると、猫をえらべます。待たずに進むときはスキップ。')).toBeVisible();

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const video = document.querySelector('.opening__video') as HTMLVideoElement | null;
        const bgm = (window as Window & { __bousaiBgm?: HTMLAudioElement }).__bousaiBgm;
        return {
          videoPlaying: Boolean(video && !video.paused && !video.loop),
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

test('finishing the opening video reaches the cat selection screen', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'はじめる' }).click();
  await expect(page.locator('.opening__video')).toBeVisible();

  await page.locator('.opening__video').evaluate((node) => {
    const video = node as HTMLVideoElement;
    video.pause();
    video.dispatchEvent(new Event('ended'));
  });

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

test('phone layout keeps start in the thumb zone without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const start = page.getByRole('button', { name: 'はじめる' });
  const skip = page.getByRole('button', { name: 'スキップ' });
  await expect(start).toBeVisible();
  await expect(skip).toBeVisible();

  const metrics = await page.evaluate(() => {
    const startBox = document.querySelector('.opening__start')?.getBoundingClientRect();
    const skipBox = document.querySelector('.opening__skip')?.getBoundingClientRect();
    return {
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      startBottom: startBox?.bottom ?? 0,
      startHeight: startBox?.height ?? 0,
      skipHeight: skipBox?.height ?? 0,
      viewportHeight: window.innerHeight
    };
  });

  expect(metrics.overflowX).toBeLessThanOrEqual(1);
  expect(metrics.startHeight).toBeGreaterThanOrEqual(56);
  expect(metrics.skipHeight).toBeGreaterThanOrEqual(44);
  expect(metrics.startBottom).toBeGreaterThan(metrics.viewportHeight * 0.72);
});

test('short phone and landscape keep the start button visible', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'はじめる' })).toBeInViewport();
  await expect(page.locator('.opening__frame')).toBeInViewport();

  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.getByRole('button', { name: 'はじめる' })).toBeInViewport();
  await expect(page.locator('.opening__frame')).toBeInViewport();
});
