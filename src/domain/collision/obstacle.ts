export interface Vec2 {
  x: number;
  z: number;
}

// cos/sin は「ローカル(u: 幅方向, v: 奥行き方向) → ワールド」の回転を表す。
// world = center + u*(cos, sin) + v*(-sin, cos)
export type Collider =
  | { kind: 'obb'; x: number; z: number; halfWidth: number; halfDepth: number; cos: number; sin: number }
  | { kind: 'circle'; x: number; z: number; radius: number };

// building.headingDeg 由来の rotation.y（THREE の規約）から OBB コライダーを作る。
// mesh.rotation.y = rotationY のとき、ローカル(lx, lz) は
//   worldX = lx*cos(rotationY) + lz*sin(rotationY)
//   worldZ = -lx*sin(rotationY) + lz*cos(rotationY)
// になる。これは本モジュールの (cos, sin) 規約で角度 -rotationY に相当する。
export function obbColliderFromFootprint(
  center: Vec2,
  width: number,
  depth: number,
  rotationY: number
): Collider {
  return {
    kind: 'obb',
    x: center.x,
    z: center.z,
    halfWidth: width / 2,
    halfDepth: depth / 2,
    cos: Math.cos(rotationY),
    sin: -Math.sin(rotationY)
  };
}

export function circleCollider(center: Vec2, radius: number): Collider {
  return { kind: 'circle', x: center.x, z: center.z, radius };
}

function cross(o: Vec2, a: Vec2, b: Vec2): number {
  return (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
}

// Andrew's monotone chain。O(n log n)。
export function convexHull2D(points: Vec2[]): Vec2[] {
  const sorted = [...points].sort((a, b) => (a.x === b.x ? a.z - b.z : a.x - b.x));
  const unique: Vec2[] = [];
  for (const p of sorted) {
    const last = unique[unique.length - 1];
    if (!last || last.x !== p.x || last.z !== p.z) {
      unique.push(p);
    }
  }
  if (unique.length < 3) {
    return unique;
  }

  const lower: Vec2[] = [];
  for (const p of unique) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: Vec2[] = [];
  for (let i = unique.length - 1; i >= 0; i -= 1) {
    const p = unique[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

export interface OrientedRect {
  center: Vec2;
  halfWidth: number;
  halfDepth: number;
  /** ラジアン。幅方向の軸がワールドX軸となす角度（標準的な数学のCCW規約）。 */
  angle: number;
}

// 凸包の各辺に幅方向を合わせた矩形のうち、面積が最小のものを探す（回転キャリパー法）。
// 非凸形状（L字など）に対しては「その形状全体を覆う最小の矩形」であり、完全な形状一致ではない。
export function minimumAreaRect(points: Vec2[]): OrientedRect {
  const hull = convexHull2D(points);

  if (hull.length === 0) {
    return { center: { x: 0, z: 0 }, halfWidth: 0, halfDepth: 0, angle: 0 };
  }
  if (hull.length === 1) {
    return { center: hull[0], halfWidth: 0, halfDepth: 0, angle: 0 };
  }
  if (hull.length === 2) {
    const [a, b] = hull;
    const angle = Math.atan2(b.z - a.z, b.x - a.x);
    return {
      center: { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 },
      halfWidth: Math.hypot(b.x - a.x, b.z - a.z) / 2,
      halfDepth: 0,
      angle
    };
  }

  let best: OrientedRect | null = null;
  let bestArea = Infinity;

  for (let i = 0; i < hull.length; i += 1) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    const angle = Math.atan2(b.z - a.z, b.x - a.x);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    let minU = Infinity;
    let maxU = -Infinity;
    let minV = Infinity;
    let maxV = -Infinity;
    for (const p of hull) {
      const u = p.x * cos + p.z * sin;
      const v = -p.x * sin + p.z * cos;
      minU = Math.min(minU, u);
      maxU = Math.max(maxU, u);
      minV = Math.min(minV, v);
      maxV = Math.max(maxV, v);
    }

    const width = maxU - minU;
    const depth = maxV - minV;
    const area = width * depth;
    if (area < bestArea) {
      bestArea = area;
      const centerU = (minU + maxU) / 2;
      const centerV = (minV + maxV) / 2;
      best = {
        center: { x: centerU * cos - centerV * sin, z: centerU * sin + centerV * cos },
        halfWidth: width / 2,
        halfDepth: depth / 2,
        angle
      };
    }
  }

  return best as OrientedRect;
}

export function obbColliderFromPoints(points: Vec2[]): Collider {
  const rect = minimumAreaRect(points);
  return {
    kind: 'obb',
    x: rect.center.x,
    z: rect.center.z,
    halfWidth: rect.halfWidth,
    halfDepth: rect.halfDepth,
    cos: Math.cos(rect.angle),
    sin: Math.sin(rect.angle)
  };
}

function collidesWithOne(point: Vec2, collider: Collider, playerRadius: number): boolean {
  if (collider.kind === 'obb') {
    const dx = point.x - collider.x;
    const dz = point.z - collider.z;
    const u = dx * collider.cos + dz * collider.sin;
    const v = -dx * collider.sin + dz * collider.cos;
    return Math.abs(u) < collider.halfWidth + playerRadius && Math.abs(v) < collider.halfDepth + playerRadius;
  }

  const dx = point.x - collider.x;
  const dz = point.z - collider.z;
  const combinedRadius = collider.radius + playerRadius;
  return dx * dx + dz * dz < combinedRadius * combinedRadius;
}

function collidesAt(point: Vec2, colliders: Collider[], playerRadius: number): boolean {
  return colliders.some((collider) => collidesWithOne(point, collider, playerRadius));
}

// 1回の呼び出しで押し出す距離の上限。この関数は移動中、毎フレーム(場合によっては
// 1フレーム内に複数回)呼ばれるため、大きすぎる値にすると「奥深くに埋まっていた場合に
// 数フレームで一気に数mワープする」ように見えてしまう。歩行速度と同程度に抑え、
// 自然に外側へ滑り出るように見せる。
const MAX_PUSH_OUT_STEP_M = 0.05;
const PUSH_OUT_MARGIN_M = 1e-4;

// point が collider の内側にあれば、最短距離で境界の外へ押し出した位置を返す。
// 内側でなければ null。
function pushOutOfCollider(point: Vec2, collider: Collider, playerRadius: number): Vec2 | null {
  let target: Vec2;

  if (collider.kind === 'obb') {
    const dx = point.x - collider.x;
    const dz = point.z - collider.z;
    const u = dx * collider.cos + dz * collider.sin;
    const v = -dx * collider.sin + dz * collider.cos;
    const halfWidth = collider.halfWidth + playerRadius;
    const halfDepth = collider.halfDepth + playerRadius;
    if (Math.abs(u) >= halfWidth || Math.abs(v) >= halfDepth) {
      return null;
    }

    // 短い方の軸に沿って、最寄りの辺の外側へ押し出す。
    const distToUEdge = halfWidth - Math.abs(u);
    const distToVEdge = halfDepth - Math.abs(v);
    let outU = u;
    let outV = v;
    if (distToUEdge <= distToVEdge) {
      outU = Math.sign(u || 1) * (halfWidth + PUSH_OUT_MARGIN_M);
    } else {
      outV = Math.sign(v || 1) * (halfDepth + PUSH_OUT_MARGIN_M);
    }
    target = {
      x: collider.x + outU * collider.cos - outV * collider.sin,
      z: collider.z + outU * collider.sin + outV * collider.cos
    };
  } else {
    const dx = point.x - collider.x;
    const dz = point.z - collider.z;
    const dist = Math.hypot(dx, dz);
    const combinedRadius = collider.radius + playerRadius;
    if (dist >= combinedRadius) {
      return null;
    }

    if (dist < 1e-9) {
      // ちょうど中心にいる場合、押し出す向きが決まらないので適当な方向へ。
      target = { x: collider.x + combinedRadius + PUSH_OUT_MARGIN_M, z: collider.z };
    } else {
      const scale = (combinedRadius + PUSH_OUT_MARGIN_M) / dist;
      target = { x: collider.x + dx * scale, z: collider.z + dz * scale };
    }
  }

  const stepDx = target.x - point.x;
  const stepDz = target.z - point.z;
  const stepDist = Math.hypot(stepDx, stepDz);
  if (stepDist <= MAX_PUSH_OUT_STEP_M) {
    return target;
  }
  const scale = MAX_PUSH_OUT_STEP_M / stepDist;
  return { x: point.x + stepDx * scale, z: point.z + stepDz * scale };
}

export function resolveObstacleMove(
  previous: Vec2,
  attempted: Vec2,
  colliders: Collider[],
  playerRadius: number
): { position: Vec2; collided: boolean } {
  // スポーン座標の誤差や、壁沿いを長く滑る際の浮動小数点誤差などで、そもそも
  // previous がコライダーの内側にあることがある。
  // そのコライダーを丸ごと今回の判定から除外すると、同じ方向へ移動し続けるだけで
  // 建物を素通りできてしまう。代わりに、最短距離で境界の外へ押し出すことを
  // 今回の入力による移動より優先する（動けなくなることもなく、素通りもさせない）。
  for (const collider of colliders) {
    const pushedOut = pushOutOfCollider(previous, collider, playerRadius);
    if (pushedOut) {
      return { position: pushedOut, collided: true };
    }
  }

  if (colliders.length === 0 || !collidesAt(attempted, colliders, playerRadius)) {
    return { position: attempted, collided: false };
  }

  // 斜め移動で壁にすり抜けないよう、X軸・Z軸を分離して滑り移動できるか試す。
  const slideX: Vec2 = { x: attempted.x, z: previous.z };
  const slideZ: Vec2 = { x: previous.x, z: attempted.z };
  const canSlideX = !collidesAt(slideX, colliders, playerRadius);
  const canSlideZ = !collidesAt(slideZ, colliders, playerRadius);

  if (canSlideX && canSlideZ) {
    const distX = Math.abs(slideX.x - previous.x);
    const distZ = Math.abs(slideZ.z - previous.z);
    return { position: distX >= distZ ? slideX : slideZ, collided: true };
  }
  if (canSlideX) {
    return { position: slideX, collided: true };
  }
  if (canSlideZ) {
    return { position: slideZ, collided: true };
  }

  return { position: previous, collided: true };
}
