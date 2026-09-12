import { expect, test, type Page } from '@playwright/test';
import { waitForCountdownToFinish } from './helpers';

/** 公開データでは locked の猫（シラヤマ）も選べるようにする。移動・物理の検証専用。 */
async function unlockAllCats(page: Page) {
  await page.route('**/data/cats.json', async (route) => {
    const response = await route.fetch();
    const cats = await response.json();
    const patched = cats.map((c: Record<string, unknown>) => ({ ...c, status: 'unlocked' }));
    await route.fulfill({ response, json: patched });
  });
}

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

  await page.locator('.cat-pin', { hasText: 'タキザワ' }).click();

  await expect(page.locator('.cat-pin--selected')).toHaveCount(1);
  await expect(start).toBeEnabled();
});

test('a sleeping (locked) cat is greyed out and cannot be selected', async ({ page }) => {
  await page.goto('/');

  const start = page.getByRole('button', { name: 'このねこでみまわりスタート' });
  await expect(page.locator('.cat-pin--locked', { hasText: 'シラヤマ' })).toHaveCount(1);

  await page.locator('.cat-pin', { hasText: 'シラヤマ' }).click();
  await expect(page.locator('.cat-pin--selected')).toHaveCount(0);
  await expect(start).toBeDisabled();

  // aria-disabled のため Playwright の actionability を外してタップを再現する
  await page.locator('.cat-item--locked', { hasText: 'シラヤマ' }).click({ force: true });
  await expect(page.getByRole('status')).toContainText('まだ 見つかっていないニャ');
  await expect(start).toBeDisabled();
});

test('starting a patrol shows the new screen from the top', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 720 });
  await page.goto('/');

  await page.locator('.cat-item:not(.cat-item--locked)').first().click();

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
  await page.locator('.cat-item:not(.cat-item--locked)').first().click();
  await page.getByRole('button', { name: 'このねこでみまわりスタート' }).click();

  await expect(page.locator('.scene-canvas')).toHaveAttribute('data-ready', 'true', {
    timeout: 20_000
  });
  await waitForCountdownToFinish(page);
  await expect(page.locator('.scene-canvas canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'てんけんする' })).toBeVisible();
  await expect(page.locator('.virtual-stick')).toBeVisible();
  await expect(page.getByRole('button', { name: 'ポーズ' })).toBeVisible();
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

test('cat pins stay aligned with their territory circles after a patrol round trip', async ({
  page
}) => {
  // S03(みまわり)→S04(結果)→この選択画面、と経由した直後にピンの位置がずれる回帰バグの再現テスト。
  // ゲーム時間を短縮してラウンドトリップを高速化する（実データファイルは変更しない）。
  // 注意: タイマーは3Dシーンの読み込み完了を待たずに進むため、この秒数はモデルの
  // 読み込み時間より確実に長くする必要がある（短すぎるとシーンが出る前に結果画面へ
  // 遷移してしまい、.scene-canvas[data-ready] が永久に現れずタイムアウトする）。
  await page.route('**/data/game-config.json', async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    await route.fulfill({ response, json: { ...json, gameDurationSec: 12 } });
  });

  await page.setViewportSize({ width: 1854, height: 900 });
  await page.goto('/');
  await page.waitForSelector('.cat-pin');

  const measureOffset = async () =>
    page.evaluate(() => {
      function centerOf(el: Element) {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }
      // タキザワ（unlocked）の円とピンで計測する。locked の猫の円はグレーに描かれる。
      const circle = document.querySelector('path.leaflet-interactive[stroke="#ea580c"]');
      const photo = document.querySelector('img.cat-pin__photo[src*="takizawa"]');
      if (!circle || !photo) {
        return null;
      }
      const c = centerOf(circle);
      const p = centerOf(photo);
      return { dx: p.x - c.x, dy: p.y - c.y };
    });

  // 初回表示は fitBounds アニメーションの収束を待ってから計測する。
  await expect
    .poll(async () => (await measureOffset())?.dx ?? 999, { timeout: 3000 })
    .toBeLessThan(5);

  await page.locator('.cat-item:not(.cat-item--locked)').first().click();
  await page.getByRole('button', { name: 'このねこでみまわりスタート' }).click();
  await page.waitForSelector('.scene-canvas[data-ready="true"]', { timeout: 20_000 });
  // S04 は4スライド（終わり→結果1→結果2→再挑戦）。行動ボタンは最後のスライドに出る。
  // タイマーは setInterval ベースで、3D描画で main thread が混雑すると tick が遅延しうる
  // ため、gameDurationSec の額面(12s)より十分長いタイムアウトを取る。
  await page.waitForSelector('text=みまわりの 結果', { timeout: 45_000 });
  for (let i = 0; i < 3; i += 1) {
    await page.getByRole('button', { name: 'つぎへ' }).click();
  }
  await page.getByRole('button', { name: '今日もう帰るにゃ' }).click();
  await page.waitForSelector('.cat-pin');

  // 修正前はここで移動後(fitBounds後)の位置に追従できず、円とピンがずれたままになっていた。
  // fitBounds のアニメーション途中を拾わないよう、dx/dy の絶対値の和が収束するまで待つ。
  await expect
    .poll(
      async () => {
        const offset = await measureOffset();
        return offset ? Math.abs(offset.dx) + Math.abs(offset.dy) : 999;
      },
      // 3D シーンの後片付けと並走すると収束が遅れることがあるため余裕を持たせる
      { timeout: 8000 }
    )
    .toBeLessThan(5);
});

test('pausing stops the timer and movement, and resuming continues normally', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('.cat-item:not(.cat-item--locked)').first().click();
  await page.getByRole('button', { name: 'このねこでみまわりスタート' }).click();

  await expect(page.locator('.scene-canvas')).toHaveAttribute('data-ready', 'true', {
    timeout: 20_000
  });
  await waitForCountdownToFinish(page);

  const remainingText = () =>
    page
      .getByText(/残り \d+s/)
      .first()
      .innerText();
  await expect.poll(remainingText).toMatch(/残り \d+s/);

  await page.getByRole('button', { name: 'ポーズ' }).click();

  await expect(page.getByText('ポーズちゅう')).toBeVisible();

  const pausedRemaining = await remainingText();
  const minimap = page.locator('.patrol-minimap');
  const pausedLat = await minimap.getAttribute('data-player-lat');

  await page.keyboard.down('w');
  await page.waitForTimeout(1200);
  await page.keyboard.up('w');

  expect(await remainingText()).toBe(pausedRemaining);
  expect(await minimap.getAttribute('data-player-lat')).toBe(pausedLat);
  await expect(page.getByRole('button', { name: 'てんけんする' })).toBeDisabled();

  await page.getByRole('button', { name: 'つづきから' }).click();
  await expect(page.getByText('ポーズちゅう')).not.toBeVisible();

  await page.keyboard.down('w');
  await expect.poll(async () => minimap.getAttribute('data-player-lat')).not.toBe(pausedLat);
  await page.keyboard.up('w');
});

test('the cat cannot walk through a hydrant and reacts with a speech bubble', async ({ page }) => {
  // 移動を速めて検証を高速化する（実データファイルは変更しない）。最寄りの消火栓まで約46m。
  await page.route('**/data/game-config.json', async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    await route.fulfill({ response, json: { ...json, playerMoveSpeedMps: 12 } });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('.cat-item:not(.cat-item--locked)').first().click();
  await page.getByRole('button', { name: 'このねこでみまわりスタート' }).click();
  await page.waitForSelector('.scene-canvas[data-ready="true"]', { timeout: 20_000 });
  await waitForCountdownToFinish(page);

  const minimap = page.locator('.patrol-minimap');
  // スポーン時は最寄りの消火栓の方を向いているので、まっすぐ前進すればぶつかる。
  await page.keyboard.down('w');
  await expect(page.locator('.patrol-speech')).toBeVisible({ timeout: 10_000 });
  const line = await page.locator('.patrol-speech').innerText();
  expect([
    'あいたっ',
    'いたいニャー',
    'ぶつかったニャ',
    'とおれないニャ',
    'いたたたニャ',
    'ここはムリだニャ',
    'まえがふさがってるニャ',
    'ニャッ、いたっ'
  ]).toContain(line);

  // ぶつかった後も壁(消火栓)に押し付け続けて、すり抜けないことを確認する。
  // 最寄りの消火栓(hydrant_1-39)の中心からの距離が、当たり判定半径を下回らないことを見る
  // （多少の滑り移動は許容するが、突き抜けはしない）。
  const hydrant = { lat: 38.9907047246839, lng: 141.114766546627 };
  const metersPerLat = 111320;
  const metersPerLng = 111320 * Math.cos((hydrant.lat * Math.PI) / 180);
  const distanceToHydrantMeters = async () => {
    const lat = Number(await minimap.getAttribute('data-player-lat'));
    const lng = Number(await minimap.getAttribute('data-player-lng'));
    const dLat = (lat - hydrant.lat) * metersPerLat;
    const dLng = (lng - hydrant.lng) * metersPerLng;
    return Math.hypot(dLat, dLng);
  };

  expect(await distanceToHydrantMeters()).toBeGreaterThan(0.5);
  await page.waitForTimeout(1000);
  expect(await distanceToHydrantMeters()).toBeGreaterThan(0.5);
  await page.keyboard.up('w');
});

test('every cat can move away from their own spawn point', async ({ page }) => {
  // タキザワはスポーン座標が実際の建物メッシュの内側に重なっており、
  // 「そのコライダーで移動を止める」実装だと永久に動けなくなっていた回帰バグの再現テスト。
  await page.setViewportSize({ width: 390, height: 844 });
  // シラヤマは公開時 locked（からだを まっている）だが、解放後もスポーンから動けることを
  // 保証したいので、このテストでは全猫を unlocked に差し替える（実データは変更しない）。
  await unlockAllCats(page);
  await page.goto('/');

  for (const catName of ['シラヤマ', 'タキザワ']) {
    await page.goto('/');
    await page.locator('.cat-item', { hasText: catName }).click();
    await page.getByRole('button', { name: 'このねこでみまわりスタート' }).click();
    await page.waitForSelector('.scene-canvas[data-ready="true"]', { timeout: 20_000 });
    await waitForCountdownToFinish(page);

    const minimap = page.locator('.patrol-minimap');
    const spawnLat = await minimap.getAttribute('data-player-lat');

    await page.keyboard.down('w');
    await expect
      .poll(async () => minimap.getAttribute('data-player-lat'), { timeout: 5_000 })
      .not.toBe(spawnLat);
    await page.keyboard.up('w');
  }
});
