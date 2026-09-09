import { describe, expect, it } from 'vitest';
import {
  circleCollider,
  convexHull2D,
  minimumAreaRect,
  obbColliderFromFootprint,
  obbColliderFromPoints,
  resolveObstacleMove
} from './obstacle';

describe('obstacle collision', () => {
  const building = obbColliderFromFootprint({ x: 0, z: -5 }, 4, 4, 0);

  it('pushes the player out toward the nearest edge, a little at a time, when starting inside a collider (e.g. bad spawn data)', () => {
    // タキザワのスポーン座標が実際の建物メッシュの内側に重なっていたケースの再現。
    // コライダーを丸ごと無効化すると同じ方向へ動き続けるだけで建物を素通りできてしまうため、
    // 最短距離の境界へ少しずつ押し出す方式になっている。
    let pos = { x: 0, z: -5 }; // building(半幅2, 中心(0,-5))の中心 = 完全に内側

    const MAX_STEPS = 100;
    let steps = 0;
    let sawCollision = false;
    // その場に留まろうとする(=attempted は毎回その時点の pos)想定で、押し出しだけを追う。
    for (; steps < MAX_STEPS; steps += 1) {
      const result = resolveObstacleMove(pos, pos, [building], 0.35);
      if (!result.collided) {
        break;
      }
      sawCollision = true;
      // 1回の押し出しは大きくジャンプしすぎない（毎フレーム呼ばれても急にワープして見えないため）。
      expect(Math.hypot(result.position.x - pos.x, result.position.z - pos.z)).toBeLessThanOrEqual(0.05 + 1e-9);
      pos = result.position;
    }
    expect(steps).toBeLessThan(MAX_STEPS); // 有限回数で必ず抜け出せること

    expect(sawCollision).toBe(true);
    // 抜け出した後は建物の外側にいる。
    expect(Math.abs(pos.x - 0)).toBeGreaterThanOrEqual(2 + 0.35 - 1e-6);
  });

  it('does not let the player slip through a wall via a marginal float-precision overlap (regression: sliding along a wall for a long time)', () => {
    // 壁沿いを長時間滑っていると、浮動小数点誤差で「ほんの少しだけ内側」に
    // 入り込むことがある。以前の実装（重なっているコライダーを丸ごと無効化する方式）
    // だと、その瞬間だけ判定が消えて奥へ進み放題になってしまっていた。
    // わずかに内側(壁からの距離0.01mだけ食い込んだ状態)から、さらに奥へ進もうとしても、
    // 外側へ押し戻されるだけで、内側への正味の移動にはならない。
    const previous = { x: 2.34, z: -5 }; // 壁(x=2.35)から0.01mだけ内側
    const attemptedDeeper = { x: 3, z: -5 }; // さらに奥へ0.66m進もうとする
    const result = resolveObstacleMove(previous, attemptedDeeper, [building], 0.35);
    expect(result.collided).toBe(true);
    // 内側への正味の移動になっていない（x はむしろ増える方向、つまり外側へ）。
    expect(result.position.x).toBeGreaterThanOrEqual(previous.x);
  });

  it('still blocks other colliders normally once the player has escaped the one they started inside', () => {
    const overlapping = obbColliderFromFootprint({ x: 0, z: -5 }, 4, 4, 0);
    const separateWall = obbColliderFromFootprint({ x: 5, z: -5 }, 2, 2, 0);
    let pos = { x: 0, z: -5 }; // overlapping の内側からスタート

    // overlapping から完全に抜け出るまで押し出しを繰り返す。
    let guard = 0;
    while (resolveObstacleMove(pos, pos, [overlapping, separateWall], 0.35).collided) {
      pos = resolveObstacleMove(pos, pos, [overlapping, separateWall], 0.35).position;
      guard += 1;
      expect(guard).toBeLessThan(100);
    }

    // 抜け出た後、別の壁(separateWall、中心(5,-5))へ向かうと通常どおりぶつかる。
    const intoSeparateWall = { x: 5, z: pos.z };
    const result = resolveObstacleMove(pos, intoSeparateWall, [overlapping, separateWall], 0.35);
    expect(result.collided).toBe(true);
  });

  it('passes through an unobstructed move', () => {
    const result = resolveObstacleMove({ x: 0, z: 0 }, { x: 1, z: 0 }, [building], 0.35);
    expect(result.collided).toBe(false);
    expect(result.position).toEqual({ x: 1, z: 0 });
  });

  it('stops a head-on move straight into a building', () => {
    const previous = { x: 0, z: -2 };
    const attempted = { x: 0, z: -3 };
    const result = resolveObstacleMove(previous, attempted, [building], 0.35);
    expect(result.collided).toBe(true);
    expect(result.position).toEqual(previous);
  });

  it('slides along the wall on a diagonal approach', () => {
    // 建物は x:[-2,2], z:[-7,-3]（半径0.35込みだと z:[-7.35,-2.65]）。
    // 斜めに突っ込むと X 方向にはスライドできるはず。
    const previous = { x: -1, z: -2.5 };
    const attempted = { x: 0.5, z: -3.2 };
    const result = resolveObstacleMove(previous, attempted, [building], 0.35);
    expect(result.collided).toBe(true);
    expect(result.position.z).toBe(previous.z);
    expect(result.position.x).toBe(attempted.x);
  });

  it('rejects a point inside a hydrant circle', () => {
    const hydrant = circleCollider({ x: 3, z: 3 }, 0.3);
    const result = resolveObstacleMove({ x: 3, z: 4 }, { x: 3, z: 3.2 }, [hydrant], 0.35);
    expect(result.collided).toBe(true);
    expect(result.position).toEqual({ x: 3, z: 4 });
  });

  it('tightly fits a diagonally rotated building instead of ballooning into a world-axis-aligned box', () => {
    // 45度回転した 4x2(半幅2・半奥行き1) の建物。
    const rotated = obbColliderFromFootprint({ x: 0, z: 0 }, 4, 2, Math.PI / 4);
    expect(rotated.kind).toBe('obb');
    if (rotated.kind === 'obb') {
      expect(rotated.halfWidth).toBeCloseTo(2);
      expect(rotated.halfDepth).toBeCloseTo(1);
    }

    // ワールドX軸方向に中心から2.05m進んだ点は、回転前の世界軸並行AABB
    // （半幅・半奥行きとも |2*cos45|+|1*sin45| ≈ 2.12 になる）だと「衝突」と
    // 誤判定されるが、実際の建物（幅方向2・奥行き方向1）には含まれないため
    // 衝突しないのが正しい。
    const falsePositiveUnderOldAabb = { x: 2.05, z: 0 };
    const result = resolveObstacleMove({ x: 10, z: 0 }, falsePositiveUnderOldAabb, [rotated], 0);
    expect(result.collided).toBe(false);
  });

  it('convex hull returns the outer points of a square with an interior point', () => {
    const hull = convexHull2D([
      { x: 0, z: 0 },
      { x: 4, z: 0 },
      { x: 4, z: 4 },
      { x: 0, z: 4 },
      { x: 2, z: 2 }
    ]);
    expect(hull).toHaveLength(4);
    expect(hull).not.toContainEqual({ x: 2, z: 2 });
  });

  it('minimum area rect recovers a rotated rectangle almost exactly', () => {
    const angle = 0.4;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const halfW = 3;
    const halfD = 1.5;
    const corners = [
      { u: -halfW, v: -halfD },
      { u: halfW, v: -halfD },
      { u: halfW, v: halfD },
      { u: -halfW, v: halfD }
    ].map(({ u, v }) => ({ x: u * cos - v * sin, z: u * sin + v * cos }));

    const rect = minimumAreaRect(corners);
    expect(rect.halfWidth * rect.halfDepth * 4).toBeCloseTo(halfW * halfD * 4, 5);
    expect(rect.center.x).toBeCloseTo(0, 5);
    expect(rect.center.z).toBeCloseTo(0, 5);
  });

  it('obbColliderFromPoints no longer false-positives where a world-axis-aligned box would have', () => {
    // ワールド上で0.5rad傾いた 6x3(半幅3・半奥行き1.5) の建物の頂点から作る。
    const angle = 0.5;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const corners = [
      { u: -3, v: -1.5 },
      { u: 3, v: -1.5 },
      { u: 3, v: 1.5 },
      { u: -3, v: 1.5 }
    ].map(({ u, v }) => ({ x: u * cos - v * sin + 10, z: u * sin + v * cos + 10 }));

    const collider = obbColliderFromPoints(corners);

    // 建物の中心は当然ぶつかる。
    expect(resolveObstacleMove({ x: 30, z: 10 }, { x: 10, z: 10 }, [collider], 0).collided).toBe(true);

    // ワールドX軸方向に中心から3.3m進んだ点は、回転前の世界軸並行AABB
    // （半幅は |3*cos|+|1.5*sin| ≈ 3.35 になる）だと「衝突」と誤判定されるが、
    // 実際の建物の向き付き矩形（幅方向3, 奥行き方向1.5）には含まれないため
    // 衝突しないのが正しい。旧方式の「見えない壁」バグが直っていることの確認。
    const falsePositiveUnderOldAabb = { x: 13.3, z: 10 };
    expect(resolveObstacleMove({ x: 30, z: 10 }, falsePositiveUnderOldAabb, [collider], 0).collided).toBe(
      false
    );

    // 建物からしっかり離れた位置なら通れる。
    const farAway = { x: 10 + 10 * cos, z: 10 + 10 * sin };
    expect(resolveObstacleMove({ x: 30, z: 10 }, farAway, [collider], 0).collided).toBe(false);
  });
});
