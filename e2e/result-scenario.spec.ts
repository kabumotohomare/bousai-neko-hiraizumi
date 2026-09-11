import { expect, test, type Page } from '@playwright/test';

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
  await page.goto('/');
  await page.locator('.cat-item', { hasText: 'タキザワ' }).click();
  await page.getByRole('button', { name: 'このねこでみまわりスタート' }).click();
  await page.waitForSelector('.scene-canvas[data-ready="true"]', { timeout: 20_000 });
}

async function walkAndInspect(page: Page, count: number) {
  const inspect = page.getByRole('button', { name: 'てんけんする' });
  for (let i = 0; i < count; i += 1) {
    await page.keyboard.down('w');
    await expect(inspect).toBeEnabled({ timeout: 15_000 });
    await page.keyboard.up('w');
    await inspect.click();
    await expect(page.getByText(`点検 ${i + 1} / 4`)).toBeVisible();
    // 800ms の連打ガードと、点検済みのしるしから離れるまで待つ
    await page.waitForTimeout(900);
  }
}

async function waitForResult(page: Page) {
  await expect(page.getByRole('heading', { name: 'ねこの 記録' })).toBeVisible({ timeout: 40_000 });
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
});

async function next(page: Page, times = 1) {
  for (let i = 0; i < times; i += 1) {
    await page.getByRole('button', { name: 'つぎへ' }).click();
  }
}

test('0本: 記録は しろい、鼻は いちばん近い しるし、足は まだ 走れていない', async ({ page }) => {
  await patchData(page, 5);
  await startTakizawa(page);
  await waitForResult(page);

  // 切断: 人格が体から出る。3つの感覚の説明
  await expect(page.getByText('タキザワ ／ ひがしの なわばり')).toBeVisible();
  await expect(page.getByText('ねこの時間、おわり。タキザワは、からだから でる。')).toBeVisible();
  await expect(page.locator('.result-senses li')).toHaveCount(3);
  await expect(page.locator('.result-screen')).toHaveAttribute('data-mood', 'empty');

  // 目（記録）
  await next(page);
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  await expect(page.locator('.result-mark')).toHaveCount(4);
  await expect(page.getByText('ひがしの なわばりの 記録は、まだ しろい。')).toBeVisible();

  // 鼻
  await next(page);
  await expect(page.locator('.result-compass__arrow')).toHaveCount(1);
  await expect(page.getByText(/いちばん近い「まだ」は、みなみ 10m。/)).toBeVisible();
  await expect(page.getByText(/みなみ 10mの あとに まわると、ちかい。/)).toBeVisible();

  // 足
  await next(page);
  await expect(page.getByText('この からだでは、まだ 走れていない。')).toBeVisible();

  // ねむり: シラヤマ（locked）が からだを まっている
  await next(page);
  await expect(page.getByText('ねこは ねむる。なにも おぼえていない。')).toBeVisible();
  await expect(page.locator('.result-sleeping')).toContainText('シラヤマ');
  await expect(
    page.getByText('シラヤマは、からだを まっている。まちの ひとが ねこを みつけたら、はいれる。')
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'もういちど遊ぶ' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'つぎへ' })).toHaveCount(0);
});

test('一部（1本）: 残りの数と きょう ふえた しるし が出る', async ({ page }) => {
  await patchData(page, 20);
  await startTakizawa(page);
  await walkAndInspect(page, 1);
  await waitForResult(page);

  await expect(page.locator('.result-screen')).toHaveAttribute('data-mood', 'low');

  await next(page);
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  await expect(page.locator('.result-mark.is-known')).toHaveCount(1);
  await expect(page.getByText('ひがしの なわばりで、まだ しらない 赤が 3つ。')).toBeVisible();
  await expect(page.getByText('きょう、記録に ふえた しるし: 1つ。')).toBeVisible();

  await next(page, 2);
  await expect(
    page.getByText(/この からだに、はじめて はいった。さいごの しるしまで \d+秒。/)
  ).toBeVisible();
  await expect(page.locator('.result-feet__bar.is-now')).toBeVisible();
});

test('全部（4本）→ もういちど: 記録は できた、2回目は まえ と くらべる', async ({ page }) => {
  test.setTimeout(120_000);
  await patchData(page, 30);
  await startTakizawa(page);
  await walkAndInspect(page, 4);
  await waitForResult(page);

  await expect(page.locator('.result-screen')).toHaveAttribute('data-mood', 'complete');

  await next(page);
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '4');
  await expect(page.getByText('ひがしの なわばりの 記録は、できた。')).toBeVisible();

  // 鼻: しらない においは ない → においは にしから（眠っている人格）
  await next(page);
  await expect(page.locator('.result-compass__arrow')).toHaveCount(0);
  await expect(page.getByText('この なわばりに、しらない においは ない。')).toBeVisible();
  await expect(
    page.getByText('においは、にしの なわばりから。まだ、だれの 記録にも ない。')
  ).toBeVisible();

  await next(page);
  await expect(page.getByText(/この からだに、はじめて はいった。/)).toBeVisible();

  // 2回目: 記録は残ったまま、足は前回比になる
  await next(page);
  await page.getByRole('button', { name: 'もういちど遊ぶ' }).click();
  await page.waitForSelector('.scene-canvas[data-ready="true"]', { timeout: 20_000 });
  await walkAndInspect(page, 4);
  await waitForResult(page);

  await next(page);
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '4');
  await next(page, 2);
  await expect(
    page.getByText(
      /(この からだの、いちばん はやい 足|からだが、みちを おぼえた。まえより はやい|まえと おなじ 足|きょうは、まわりみちを した)。\d+秒。/
    )
  ).toBeVisible();
  await expect(page.getByText(/まえ: 4つ、\d+秒。/)).toBeVisible();
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
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '猫をえらぶ' })).toBeVisible();
  await expect(page.locator('.cat-item.selected', { hasText: 'タキザワ' })).toBeVisible();
});

test('前回選択が locked の猫（シラヤマ）なら復元しない', async ({ page }) => {
  await seedLegacyProgress(page, 'cat_001');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '猫をえらぶ' })).toBeVisible();
  await expect(page.locator('.cat-item.selected')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'このねこでみまわりスタート' })).toBeDisabled();
});
