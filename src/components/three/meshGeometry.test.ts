import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { placeObjectOnGround, worldXZPointsOfMesh } from './meshGeometry';

/**
 * H3（GLBの形とOBBのずれ）の実体を固定する回帰テスト。
 *
 * ランドマーク建物は placeObjectOnGround() で lat/lng 由来のワールド座標へ
 * 配置されるが、three.js は position/scale/rotation を変更しただけでは
 * matrixWorld を更新しない。placeObjectOnGround の最後の呼び出しは
 * root.position.set(...) であり、その直後に model.updateMatrixWorld(true)
 * を呼ばないと、child.matrixWorld はまだ「配置前（ワールド原点付近）」の
 * 姿勢のままになる。当たり判定(OBB)はこの matrixWorld から頂点を
 * ワールド座標へ変換して作るため、更新を怠ると見えている建物の位置とは
 * まったく無関係な場所（ワールド原点付近）に当たり判定ができてしまう。
 */
describe('landmark collider placement (H3)', () => {
  it('computes mesh world points at the placed location once matrixWorld is refreshed', () => {
    const model = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
    model.add(mesh);

    // 建物はワールド原点から遠く離れた場所（lat/lng 由来の座標）に配置される想定。
    const targetX = 500;
    const targetZ = -300;
    placeObjectOnGround(model, targetX, targetZ);
    model.updateMatrixWorld(true);

    const points = worldXZPointsOfMesh(mesh);
    expect(points.length).toBeGreaterThan(0);

    const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const centerZ = points.reduce((sum, p) => sum + p.z, 0) / points.length;

    // 頂点群の重心は配置先のワールド座標の近くにあるべき（原点付近ではない）。
    expect(centerX).toBeCloseTo(targetX, 0);
    expect(centerZ).toBeCloseTo(targetZ, 0);
  });

  it('would collide near world origin instead of the building if matrixWorld were left stale', () => {
    // 修正前の再現：updateMatrixWorld を呼ばないと頂点は原点付近のまま。
    const model = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
    model.add(mesh);

    placeObjectOnGround(model, 500, -300);
    // 意図的に updateMatrixWorld を呼ばない（バグの再現）。

    const staleCenterX =
      worldXZPointsOfMesh(mesh).reduce((sum, p) => sum + p.x, 0) / worldXZPointsOfMesh(mesh).length;

    expect(Math.abs(staleCenterX)).toBeLessThan(5);
  });
});
