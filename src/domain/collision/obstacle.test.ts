import { describe, expect, it } from 'vitest';
import {
  circleCollider,
  convexHull2D,
  meshCollider,
  minimumAreaRect,
  obbColliderFromFootprint,
  obbColliderFromPoints,
  resolveObstacleMove,
  Vec2
} from './obstacle';

// L字の建物footprint: X:[0,10]×Z:[0,10]の正方形から、右奥(X:[6,10]×Z:[6,10])の
// 4x4を切り欠いた形。切り欠き部分は実際には屋外(通路や隣地)。
function lShapedBuilding() {
  const triangles: [Vec2, Vec2, Vec2][] = [
    // 下側の帯(X:[0,10]×Z:[0,6])
    [
      { x: 0, z: 0 },
      { x: 10, z: 0 },
      { x: 10, z: 6 }
    ],
    [
      { x: 0, z: 0 },
      { x: 10, z: 6 },
      { x: 0, z: 6 }
    ],
    // 左上の帯(X:[0,6]×Z:[6,10])
    [
      { x: 0, z: 6 },
      { x: 6, z: 6 },
      { x: 6, z: 10 }
    ],
    [
      { x: 0, z: 6 },
      { x: 6, z: 10 },
      { x: 0, z: 10 }
    ]
  ];
  const edges: [Vec2, Vec2][] = [
    [
      { x: 0, z: 0 },
      { x: 10, z: 0 }
    ],
    [
      { x: 10, z: 0 },
      { x: 10, z: 6 }
    ],
    [
      { x: 10, z: 6 },
      { x: 6, z: 6 }
    ],
    [
      { x: 6, z: 6 },
      { x: 6, z: 10 }
    ],
    [
      { x: 6, z: 10 },
      { x: 0, z: 10 }
    ],
    [
      { x: 0, z: 10 },
      { x: 0, z: 0 }
    ]
  ];
  return meshCollider(triangles, edges);
}

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

  describe('honors player input to escape a bad spawn instead of forcing a fixed direction (regression: タキザワ spawn stuck moving backward)', () => {
    it('moves the player in their own chosen escape direction, even when it is not the nearest edge', () => {
      // building(半幅2+半径0.35=2.35, 中心(0,-5))の内側、X軸・Z軸どちらの辺からも
      // 同じ距離(0.55m)にいる状態。旧実装はタイブレークで常にX軸方向へ押し出していたため、
      // プレイヤーがZ軸方向(南)へ進もうとしても無視されてX方向へ動かされてしまっていた。
      const previous = { x: -1.8, z: -6.8 };
      const attempted = { x: -1.8, z: -7.0 }; // Z軸方向(南)への0.2mの入力

      const result = resolveObstacleMove(previous, attempted, [building], 0.35);

      // 入力どおりZ方向へ進めており、旧実装のようにX方向へ動かされていない。
      expect(result.position.x).toBeCloseTo(previous.x, 6);
      expect(result.position.z).toBeCloseTo(attempted.z, 6);
    });

    it('lets the player walk all the way out over several small steps in their own direction', () => {
      let pos = { x: -1.8, z: -6.8 };
      const step = 0.2;

      for (let i = 0; i < 20; i += 1) {
        const attempted = { x: pos.x, z: pos.z - step };
        const result = resolveObstacleMove(pos, attempted, [building], 0.35);
        pos = result.position;
        if (!result.collided) {
          break;
        }
      }

      // 建物の外(Z軸方向)まで自力で歩いて出られている。
      expect(pos.z).toBeLessThanOrEqual(-7.35 + 1e-6);
    });

    it('still forces the fixed push-out when the input moves deeper into the collider instead of escaping', () => {
      const previous = { x: -1.8, z: -6.8 };
      const attempted = { x: -1.7, z: -6.7 }; // 中心方向(食い込みが増える方向)への小さな入力

      const result = resolveObstacleMove(previous, attempted, [building], 0.35);

      expect(result.collided).toBe(true);
      // 入力(中心方向)どおりには動いていない。強制的な押し出しに従っている。
      expect(result.position).not.toEqual(attempted);
      expect(Math.hypot(result.position.x - previous.x, result.position.z - previous.z)).toBeLessThanOrEqual(0.05 + 1e-9);
    });
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

describe('mesh collider for non-convex (L-shaped) buildings (regression: invisible wall in an L-shaped building notch)', () => {
  // 実機(タキザワの territory)で「何もない場所で見えない壁にぶつかる」と報告された症状の再現。
  // 実際の建物メッシュはL字などの非凸形状を含むが、以前は単一のOBB(外接矩形)で
  // 当たり判定を作っていたため、L字の凹んだ部分(実際には屋外)まで塞いでしまっていた。
  it('does not block the concave notch that is actually open ground (H3)', () => {
    const lBuilding = lShapedBuilding();
    // (8, 8) はL字の切り欠き部分＝建物の外。
    const inNotch = { x: 8, z: 8 };
    const result = resolveObstacleMove({ x: 12, z: 8 }, inNotch, [lBuilding], 0.35);
    expect(result.collided).toBe(false);
    expect(result.position).toEqual(inNotch);
  });

  it('still blocks the solid part of the L-shaped building', () => {
    const lBuilding = lShapedBuilding();
    const inSolidPart = { x: 3, z: 3 };
    const result = resolveObstacleMove({ x: 3, z: 12 }, inSolidPart, [lBuilding], 0.35);
    expect(result.collided).toBe(true);
  });

  it('demonstrates the fix: the old single-OBB approach would have blocked the same notch point', () => {
    // 修正前の実装がしていたこと: L字全体の頂点から単一のOBBを作ると、
    // 切り欠き部分ごと覆う「その形状全体を覆う最小の矩形」になってしまう。
    const allPoints: Vec2[] = [
      { x: 0, z: 0 },
      { x: 10, z: 0 },
      { x: 10, z: 6 },
      { x: 6, z: 6 },
      { x: 6, z: 10 },
      { x: 0, z: 10 }
    ];
    const oldStyleObb = obbColliderFromPoints(allPoints);
    const inNotch = { x: 8, z: 8 };
    const oldResult = resolveObstacleMove({ x: 12, z: 8 }, inNotch, [oldStyleObb], 0.35);
    // 旧方式では、屋外であるはずの切り欠き部分でも「衝突」と誤判定していた。
    expect(oldResult.collided).toBe(true);
  });

  it('pushes the player out of the solid part toward the nearest real edge, not through the notch', () => {
    const lBuilding = lShapedBuilding();
    const pos = { x: 3, z: 3 }; // 下側の帯の内側からスタート
    const result = resolveObstacleMove(pos, pos, [lBuilding], 0.35);
    expect(result.collided).toBe(true);
    // 押し出し後もL字の輪郭のすぐ外側に留まる(遠くへワープしない)。
    expect(Math.hypot(result.position.x - pos.x, result.position.z - pos.z)).toBeLessThanOrEqual(0.05 + 1e-9);
  });

  it('lets the player slide along an L-shaped wall on a diagonal approach', () => {
    const lBuilding = lShapedBuilding();
    // 下辺(Z=0)のすぐ外から、斜めに壁へ向かう。
    const previous = { x: 5, z: -0.5 };
    const attempted = { x: 5.5, z: 0.2 }; // Zだけ壁の内側に入ろうとする
    const result = resolveObstacleMove(previous, attempted, [lBuilding], 0.35);
    expect(result.collided).toBe(true);
    // X方向にはスライドできる(Zは壁の外に留まる)。
    expect(result.position.x).toBeCloseTo(attempted.x, 6);
    expect(result.position.z).toBeLessThan(0);
  });
});

const PLAYER_RADIUS = 0.35;
const MAX_MOVE_STEP_M = 0.2;

/** PatrolScene と同じ前方オフセット（heading=0 で -Z＝北）。 */
function offsetForward(start: { x: number; z: number }, heading: number, distance: number) {
  return {
    x: start.x + Math.sin(heading) * distance,
    z: start.z - Math.cos(heading) * distance
  };
}

/** みまわり画面のダッシュ分割移動を、ドメインだけで再現する。 */
function simulateSteppedMove(
  start: { x: number; z: number },
  heading: number,
  distance: number,
  colliders: ReturnType<typeof obbColliderFromFootprint>[]
) {
  let pos = { ...start };
  let remaining = distance;
  while (Math.abs(remaining) > 1e-9) {
    const stepAbs = Math.min(Math.abs(remaining), MAX_MOVE_STEP_M);
    const step = Math.sign(remaining) * stepAbs;
    remaining -= step;
    const previous = { ...pos };
    const attempted = offsetForward(pos, heading, step);
    const result = resolveObstacleMove(previous, attempted, colliders, PLAYER_RADIUS);
    pos = result.position;
    if (result.collided && pos.x === previous.x && pos.z === previous.z) {
      break;
    }
  }
  return pos;
}

describe('dash stepped move vs buildings (H1 / H2)', () => {
  it('does not dash through an axis-aligned building in one 0.5m frame (H1)', () => {
    const building = obbColliderFromFootprint({ x: 0, z: -5 }, 4, 4, 0);
    // 建物の南面のすぐ外側から、北（建物の中）へ 0.5m＝ダッシュ1フレーム相当。
    const start = { x: 0, z: -2.2 };
    const end = simulateSteppedMove(start, 0, 0.5, [building]);
    // 建物中心 z=-5 まで到達していたらすり抜け。
    expect(end.z).toBeGreaterThan(-3.5);
  });

  it('does not keep dashing through after a push-out from inside (H1)', () => {
    const building = obbColliderFromFootprint({ x: 0, z: -5 }, 4, 4, 0);
    // 中心から北向きへダッシュ。押し出し後も残距離で奥へ進んではいけない。
    const start = { x: 0, z: -5 };
    const end = simulateSteppedMove(start, 0, 0.5, [building]);
    const stillInside = Math.abs(end.x) < 2.35 && end.z < -2.65 && end.z > -7.35;
    expect(stillInside).toBe(true);
    // 押し出しで北へ少し動くのはよいが、建物の北側の外へワープしない。
    expect(end.z).toBeGreaterThan(-7.35);
    expect(end.z).toBeLessThan(-2.5);
  });

  it('does not world-axis-slide through a 45-degree building (H2)', () => {
    const rotated = obbColliderFromFootprint({ x: 0, z: 0 }, 4, 4, Math.PI / 4);
    // 斜め建物の角の外側から、建物を横切る向きへ 0.5m。
    const start = { x: 0, z: 3.3 };
    const end = simulateSteppedMove(start, 0, 0.5, [rotated]);
    // すり抜けて北側 (z が小さく / 負) へ出ていないこと。
    expect(end.z).toBeGreaterThan(2.4);
  });

  it('stops at a 45-degree building instead of dashing 8m through it (H2 long)', () => {
    const rotated = obbColliderFromFootprint({ x: 0, z: 0 }, 4, 4, Math.PI / 4);
    const start = { x: 0, z: 4 };
    const end = simulateSteppedMove(start, 0, 8, [rotated]);
    expect(end.z).toBeGreaterThan(2);
    expect(end.z).toBeLessThan(4.01);
  });

  it('stops at an axis-aligned building instead of dashing 8m through it (H1 long)', () => {
    const building = obbColliderFromFootprint({ x: 0, z: -5 }, 4, 4, 0);
    const start = { x: 0, z: -2.2 };
    const end = simulateSteppedMove(start, 0, 8, [building]);
    expect(end.z).toBeGreaterThan(-3.5);
    expect(end.z).toBeLessThan(-2.1);
  });
});
