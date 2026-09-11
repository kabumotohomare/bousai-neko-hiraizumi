import { expect, test } from '@playwright/test';

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const metersPerLat = 111320;
  const metersPerLng = 111320 * Math.cos((a.lat * Math.PI) / 180);
  const dLat = (a.lat - b.lat) * metersPerLat;
  const dLng = (a.lng - b.lng) * metersPerLng;
  return Math.hypot(dLat, dLng);
}

test('territory boundary stops the cat without a rubber-band snap back (H8)', async ({ page }) => {
  // 縄張り半径を小さくし(3m)、スポーン直後に境界へ到達するようにして検証を高速化する。
  // シラヤマは公開データでは locked（選べない）なので、このテストでは unlocked に差し替える。
  await page.route('**/data/cats.json', async (route) => {
    const response = await route.fetch();
    const cats = await response.json();
    const patched = cats.map((c: Record<string, unknown>) =>
      c.id === 'cat_001' ? { ...c, radius: 3, status: 'unlocked' } : c
    );
    await route.fulfill({ response, json: patched });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('.cat-item', { hasText: 'シラヤマ' }).click();
  await page.getByRole('button', { name: 'このねこでみまわりスタート' }).click();
  await page.waitForSelector('.scene-canvas[data-ready="true"]', { timeout: 20_000 });

  const minimap = page.locator('.patrol-minimap');
  const center = { lat: 38.99066, lng: 141.11424 };
  const radius = 3;

  const currentPos = async () => ({
    lat: Number(await minimap.getAttribute('data-player-lat')),
    lng: Number(await minimap.getAttribute('data-player-lng'))
  });

  await page.keyboard.down('w');

  // まず境界(3m)まで到達するのを待つ。
  await expect
    .poll(async () => distanceMeters(center, await currentPos()), {
      timeout: 8_000,
      intervals: [100]
    })
    .toBeGreaterThan(radius - 0.3);

  // 境界到達後、押し続けている間に大きく中心側へスナップバックしないことを確認する。
  // 修正前は固定0.75m押し戻しにより、境界のすぐ内側(2.5m未満)まで戻ることがあった。
  const distancesAfterBoundary: number[] = [];
  for (let i = 0; i < 10; i += 1) {
    await page.waitForTimeout(120);
    distancesAfterBoundary.push(distanceMeters(center, await currentPos()));
  }
  await page.keyboard.up('w');

  for (const distance of distancesAfterBoundary) {
    expect(distance).toBeGreaterThan(radius - 0.5);
  }
});

test('タキザワ moves in the direction she is facing, not backward (regression: spawn embedded in a real building)', async ({
  page
}) => {
  // タキザワのスポーン座標(修正前)は、平泉の実データ(hiraizumi-town.glb)由来の
  // 実在の建物メッシュに深く(数m)重なっていた。previous がコライダーの内側にある間、
  // 押し出しロジックが入力を無視して「最寄りの辺」へ向かう固定方向にだけ進めていたため、
  // 前進を押しているのに、その固定方向(たまたまheadingとほぼ逆向き)へ動いてしまい、
  // 「前に進もうとすると後ろに進む」という操作不能な状態になっていた。
  //
  // このテストは、実際のスポーン地点から「はしる」前進入力をした際の移動方向が、
  // スポーン時のheading(ミニマップの矢印の向き)と一致することを確認する。
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('.cat-item', { hasText: 'タキザワ' }).click();
  await page.getByRole('button', { name: 'このねこでみまわりスタート' }).click();
  await page.waitForSelector('.scene-canvas[data-ready="true"]', { timeout: 20_000 });

  const minimap = page.locator('.patrol-minimap');
  const currentPos = async () => ({
    lat: Number(await minimap.getAttribute('data-player-lat')),
    lng: Number(await minimap.getAttribute('data-player-lng'))
  });
  const getHeadingRad = async () => {
    const transform = await page
      .locator('.minimap-player__arrow')
      .evaluate((el) => (el as HTMLElement).style.transform);
    const match = transform.match(/rotate\(([-\d.]+)deg\)/);
    return match ? (parseFloat(match[1]) * Math.PI) / 180 : null;
  };

  const before = await currentPos();
  const heading = await getHeadingRad();
  expect(heading).not.toBeNull();

  await page.keyboard.down('w');
  await page.waitForTimeout(1000);
  const after = await currentPos();
  await page.keyboard.up('w');

  const metersPerLat = 111320;
  const metersPerLng = metersPerLat * Math.cos((before.lat * Math.PI) / 180);
  const dxWorld = (after.lng - before.lng) * metersPerLng;
  const dzWorld = -(after.lat - before.lat) * metersPerLat;
  const moved = Math.hypot(dxWorld, dzWorld);
  expect(moved).toBeGreaterThan(0.3); // ちゃんと動けている(その場に固まっていない)

  const predicted = { x: Math.sin(heading!), z: -Math.cos(heading!) };
  const dot = (dxWorld / moved) * predicted.x + (dzWorld / moved) * predicted.z;

  // 移動方向が向いている方向とほぼ一致している(逆向きに動いていない)ことを確認する。
  expect(dot).toBeGreaterThan(0.8);
});
