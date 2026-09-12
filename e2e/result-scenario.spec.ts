import { expect, test, type Page } from '@playwright/test';
import { dismissEnding, openApp } from './helpers';

/**
 * S04 リザルトのシナリオ分岐（記録 → 鼻 → 足）を、ゲーム結果を作って確認する。
 * 検証を速くするため、制限時間を短くし、消火栓をスポーン正面の一直線上に並べ替える。
 * （プレイヤーはスポーン時に最も近い消火栓の方を向く仕様を利用）
 */

const takizawaSpawn = { lat: 38.9888613, lng: 141.11681317 };
const metersPerLat = 111320;

const metersPerLng = 111320 * Math.cos((takizawaSpawn.lat * Math.PI) / 180);
// 実データの最寄り消火栓（hydrant_1-4）と同じ方位（≒南、道の上）に一直線に並べる。
const ROAD_BEARING_DEG = 184.9;

function alongRoad(meters: number) {
  const rad = (ROAD_BEARING_DEG * Math.PI) / 180;
  return {
    lat: takizawaSpawn.lat + (meters * Math.cos(rad)) / metersPerLat,
    lng: takizawaSpawn.lng + (meters * Math.sin(rad)) / metersPerLng
  };
}

async function patchData(page: Page, durationSec: number) {
  await page.route('**/data/game-config.json', async (route) => {
    const response = await route.fetch();
    const config = await response.json();
    await route.fulfill({ response, json: { ...config, gameDurationSec: durationSec } });
  });
  await page.route('**/data/hydrants.json', async (route) => {
    const response = await route.fetch();
    const json = [5, 11, 17, 23].map((meters, index) => ({
      id: `test_${index + 1}`,
      sourceId: `test_${index + 1}`,
      name: `test ${meters}m`,
      ...alongRoad(meters),
      type: 'ground',
      status: 'active'
    }));
    await route.fulfill({ response, json });
  });
}

async function startTakizawa(page: Page) {
  await openApp(page);
  await page.locator('.cat-item', { hasText: 'タキザワ' }).click();
  await page.getByRole('button', { name: 'このねこでみまわりスタート' }).click();
  await page.waitForSelector('.scene-canvas[data-ready="true"]', { timeout: 20_000 });
}

async function walkAndInspect(page: Page, count: number) {
  const inspect = page.getByRole('button', { name: 'てんけんする' });
  for (let i = 0; i < count; i += 1) {
    await page.keyboard.down('w');
    // 並列実行で 3D 描画が重いと歩く速さが落ちるため、余裕を持たせる
    await expect(inspect).toBeEnabled({ timeout: 25_000 });
    await page.keyboard.up('w');
    await inspect.click();
    await expect(page.getByText(`点検 ${i + 1} / 4`)).toBeVisible();
    // 800ms の連打ガードと、点検済みのしるしから離れるまで待つ
    await page.waitForTimeout(900);
  }
}

async function waitForResult(page: Page) {
  await expect(page.getByRole('heading', { name: 'みまわりの 結果' })).toBeVisible({
    timeout: 40_000
  });
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
});

async function next(page: Page, times = 1) {
  for (let i = 0; i < times; i += 1) {
    await page.getByRole('button', { name: 'つぎへ' }).click();
  }
}

test('0本: 見つからなかった、のこってる消火栓の方角、タイムなし、再挑戦にシラヤマ案内', async ({
  page
}) => {
  await patchData(page, 5);
  await startTakizawa(page);
  await waitForResult(page);

  // 終わり
  await expect(page.getByText('タキザワ ／ ひがしの なわばり')).toBeVisible();
  await expect(page.getByText('タキザワの みまわり、おわりニャ')).toBeVisible();
  await expect(page.locator('.result-step')).toHaveCount(4);
  await expect(page.locator('.result-screen')).toHaveAttribute('data-mood', 'empty');

  // 結果1: 見つけた（0）＋ のこってる（コンパス）
  await next(page);
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  await expect(page.locator('.result-mark')).toHaveCount(4);
  await expect(page.getByText('きょうは 見つからなかったニャ')).toBeVisible();
  await expect(page.locator('.result-compass__arrow')).toHaveCount(1);
  await expect(page.getByText(/つぎは みなみ 10m に あるニャ/)).toBeVisible();
  await expect(page.getByText(/その あとは みなみ 10mニャ/)).toBeVisible();

  // 結果2: タイム
  await next(page);
  await expect(page.getByText('つぎは 時間内に 見つけるニャ')).toBeVisible();
  await expect(page.locator('.result-feet__best')).toHaveCount(0);

  // 再挑戦: ボタン2つ ＋ シラヤマ（locked）は「見かけたら おしえて」
  await next(page);
  await expect(page.getByText('もう一回 やるニャ？')).toBeVisible();
  await expect(page.getByRole('button', { name: 'もう一回 挑戦するにゃ。' })).toBeVisible();
  await expect(page.getByRole('button', { name: '今日もう帰るにゃ' })).toBeVisible();
  await expect(
    page.getByText('にしの なわばりにも ねこが いるニャ。見かけたら おしえてニャ')
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'ねこの もくげきほうこく' })).toBeVisible();
  await expect(page.locator('.result-screen')).not.toContainText('からだ');
  await expect(page.getByRole('button', { name: 'つぎへ' })).toHaveCount(0);

  // 今日もう帰る → エンディング → 猫えらび
  await page.getByRole('button', { name: '今日もう帰るにゃ' }).click();
  await expect(page.locator('.ending .opening__video')).toHaveAttribute('src', '/op/ending.mp4');
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const bgm = (window as Window & { __bousaiEndingBgm?: HTMLAudioElement }).__bousaiEndingBgm;
        return Boolean(bgm && !bgm.paused && bgm.loop);
      })
    )
    .toBe(true);
  await dismissEnding(page);
  await expect(page.getByRole('heading', { name: '猫をえらぶ' })).toBeVisible();
});

test('一部（1本）: 見つけた数、はじめてのタイム', async ({ page }) => {
  // 20秒の制限時間＋結果表示待ちが既定の 30秒 を超えうるため
  test.setTimeout(90_000);
  await patchData(page, 20);
  await startTakizawa(page);
  await walkAndInspect(page, 1);
  await waitForResult(page);

  await expect(page.locator('.result-screen')).toHaveAttribute('data-mood', 'low');

  await next(page);
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  await expect(page.locator('.result-mark.is-known')).toHaveCount(1);
  await expect(page.getByText('消火栓を 1こ みつけられたニャ')).toBeVisible();
  // 初回は「あたらしく」の行は出ない（見つけた数と同じになるため）
  await expect(page.getByText(/あたらしく 見つけたのは/)).toHaveCount(0);
  await expect(page.locator('.result-compass__arrow')).toHaveCount(1);

  await next(page);
  await expect(page.getByText(/はじめての タイムだニャ。\d+秒/)).toBeVisible();
  await expect(page.locator('.result-feet__bar.is-now')).toBeVisible();
});

test('全部（4本）→ もう一回: ぜんぶ 見つけた、2回目は 前回と くらべる', async ({ page }) => {
  test.setTimeout(120_000);
  await patchData(page, 30);
  await startTakizawa(page);
  await walkAndInspect(page, 4);
  await waitForResult(page);

  await expect(page.locator('.result-screen')).toHaveAttribute('data-mood', 'complete');

  // 結果1: 全部 → のこってる区画は出ない
  await next(page);
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '4');
  await expect(page.getByText('ぜんぶ 見つけたニャ！')).toBeVisible();
  await expect(page.locator('.result-remaining')).toHaveCount(0);
  await expect(page.locator('.result-compass')).toHaveCount(0);

  await next(page);
  await expect(page.getByText(/はじめての タイムだニャ。/)).toBeVisible();

  // 2回目: 記録は残ったまま、タイムは前回比＋自己ベスト表示
  await next(page);
  await page.getByRole('button', { name: 'もう一回 挑戦するにゃ。' }).click();
  await page.waitForSelector('.scene-canvas[data-ready="true"]', { timeout: 20_000 });
  await walkAndInspect(page, 4);
  await waitForResult(page);

  await next(page);
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '4');
  await next(page);
  await expect(
    page.getByText(
      /(自己ベストだニャ！|前回よりも 早く できたニャ。|もっと 早く 走れたニャ。) ?\d+秒/
    )
  ).toBeVisible();
  await expect(page.getByText(/まえ: 4こ、\d+秒/)).toBeVisible();
  await expect(page.locator('.result-feet__best')).toContainText(/いちばん 早い: \d+秒/);
  await expect(page.locator('.result-feet__bar.is-prev')).toBeVisible();
});

/** lastRunByCat を持たない旧形式の localStorage を書き込む */
async function seedLegacyProgress(page: Page, lastSelectedCatId: string) {
  await page.addInitScript((catId) => {
    localStorage.setItem(
      'bousaiNeko.progress',
      JSON.stringify({
        unlockedCatIds: ['cat_001'],
        inspectedHydrantIds: [],
        playedTutorial: false,
        lastSelectedCatId: catId,
        lastPlayedAt: null
      })
    );
  }, lastSelectedCatId);
}

test('既存の localStorage（lastRunByCat なし）でも起動する', async ({ page }) => {
  await seedLegacyProgress(page, 'cat_002');
  await openApp(page);
  await expect(page.getByRole('heading', { name: '猫をえらぶ' })).toBeVisible();
  await expect(page.locator('.cat-item.selected', { hasText: 'タキザワ' })).toBeVisible();
});

test('前回選択が locked の猫（シラヤマ）なら復元しない', async ({ page }) => {
  await seedLegacyProgress(page, 'cat_001');
  await openApp(page);
  await expect(page.getByRole('heading', { name: '猫をえらぶ' })).toBeVisible();
  await expect(page.locator('.cat-item.selected')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'このねこでみまわりスタート' })).toBeDisabled();
});
