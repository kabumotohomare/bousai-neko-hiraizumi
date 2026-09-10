import * as THREE from 'three';
import { Vec2 } from '../../domain/collision/obstacle';

// メッシュの頂点をワールド座標のXZ平面へ投影した点群を返す。
// 呼び出し側で mesh.matrixWorld が最新の配置を反映していることを保証すること
// （position/scale/rotation を変更しただけでは matrixWorld は更新されない）。
export function worldXZPointsOfMesh(mesh: THREE.Mesh, maxWorldY?: number): Vec2[] {
  const posAttr = mesh.geometry.getAttribute('position');
  if (!posAttr) {
    return [];
  }

  const v = new THREE.Vector3();
  const points: Vec2[] = [];
  for (let i = 0; i < posAttr.count; i += 1) {
    v.fromBufferAttribute(posAttr, i).applyMatrix4(mesh.matrixWorld);
    if (maxWorldY !== undefined && v.y > maxWorldY) {
      continue;
    }
    points.push({ x: v.x, z: v.z });
  }
  return points;
}

export interface MeshFootprint {
  /** メッシュをXZ平面へ投影した三角形群(ワールド座標)。中に入っているかの厳密な判定に使う。 */
  triangles: [Vec2, Vec2, Vec2][];
  /** 三角形分割の内部対角線を除いた、輪郭の外周線分のみ。最寄り辺の計算に使う。 */
  edges: [Vec2, Vec2][];
}

function edgeKey(a: Vec2, b: Vec2): string {
  const round = (n: number) => Math.round(n * 1000) / 1000;
  const ka = `${round(a.x)},${round(a.z)}`;
  const kb = `${round(b.x)},${round(b.z)}`;
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
}

// XZ平面に投影したときの三角形の符号付き面積の2倍（シューレースの公式）。
function signedArea2(a: Vec2, b: Vec2, c: Vec2): number {
  return (b.x - a.x) * (c.z - a.z) - (c.x - a.x) * (b.z - a.z);
}

// メッシュの全三角形をXZ平面へ投影した footprint（輪郭形状）を抽出する。
// 建物のOBB(単一の外接矩形)は非凸形状(L字など)に対しては形状全体を覆う矩形になり、
// 実際には建物の外(凹んだ部分)なのに当たり判定が生じてしまう。この関数は代わりに
// 実際のメッシュの三角形をそのまま使うことで、凹形状でも見た目どおりの当たり判定を作れるようにする。
//
// 高さでの絞り込みは行わない。壁の三角形は上端・下端の頂点をまたぐため高さで
// 絞り込むとほぼ全て除外されてしまう。代わりに、垂直な壁の三角形はXZ平面へ
// 投影すると面積がほぼ0(2頂点が同じXZ座標に重なる)につぶれるため、
// 自然に無視される。実際に建物の輪郭を形作るのは、水平に近い屋根・床面の
// 三角形（面積を持つもの）だけになる。
//
// 呼び出し側で mesh.matrixWorld が最新であることを保証すること。
export function footprintOfMesh(mesh: THREE.Mesh): MeshFootprint {
  const posAttr = mesh.geometry.getAttribute('position');
  if (!posAttr) {
    return { triangles: [], edges: [] };
  }

  const worldPositions: THREE.Vector3[] = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < posAttr.count; i += 1) {
    worldPositions.push(v.fromBufferAttribute(posAttr, i).applyMatrix4(mesh.matrixWorld).clone());
  }

  const index = mesh.geometry.getIndex();
  const triangleIndices: [number, number, number][] = [];
  if (index) {
    for (let i = 0; i + 2 < index.count; i += 3) {
      triangleIndices.push([index.getX(i), index.getX(i + 1), index.getX(i + 2)]);
    }
  } else {
    for (let i = 0; i + 2 < worldPositions.length; i += 3) {
      triangleIndices.push([i, i + 1, i + 2]);
    }
  }

  const MIN_AREA2 = 1e-4; // これ未満は「壁がXZに潰れた」degenerateな三角形とみなす。
  const triangles: [Vec2, Vec2, Vec2][] = [];
  const edgeOccurrences = new Map<string, { a: Vec2; b: Vec2; count: number }>();
  const seenTriangleKeys = new Set<string>();

  for (const [ia, ib, ic] of triangleIndices) {
    const pa = worldPositions[ia];
    const pb = worldPositions[ib];
    const pc = worldPositions[ic];
    if (!pa || !pb || !pc) {
      continue;
    }

    const a = { x: pa.x, z: pa.z };
    const b = { x: pb.x, z: pb.z };
    const c = { x: pc.x, z: pc.z };
    if (Math.abs(signedArea2(a, b, c)) < MIN_AREA2) {
      continue;
    }

    // 床面と屋根面など、XZ投影が同じ形になる三角形が二重に存在することがある
    // （閉じたソリッドメッシュなど）。同じ2D三角形を2回数えると、本来1つの
    // 三角形にしか属さないはずの輪郭の辺が「2回登場した」と誤判定され、
    // 内部の対角線と区別できなくなってしまう。そのため2D形状が同じ三角形は
    // 1回だけ数える。
    const round = (n: number) => Math.round(n * 1000) / 1000;
    const triangleKey = [a, b, c]
      .map((p) => `${round(p.x)},${round(p.z)}`)
      .sort()
      .join('|');
    if (seenTriangleKeys.has(triangleKey)) {
      continue;
    }
    seenTriangleKeys.add(triangleKey);

    triangles.push([a, b, c]);

    for (const [p, q] of [
      [a, b],
      [b, c],
      [c, a]
    ] as [Vec2, Vec2][]) {
      const key = edgeKey(p, q);
      const existing = edgeOccurrences.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        edgeOccurrences.set(key, { a: p, b: q, count: 1 });
      }
    }
  }

  // ちょうど1つの三角形にしか属さない辺 = 三角形分割の対角線ではない、本当の輪郭線。
  const edges: [Vec2, Vec2][] = [];
  for (const e of edgeOccurrences.values()) {
    if (e.count === 1) {
      edges.push([e.a, e.b]);
    }
  }

  return { triangles, edges };
}

export function placeObjectOnGround(root: THREE.Object3D, x: number, z: number): void {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());

  if (size.y > 0 && (size.y < 2 || size.y > 25)) {
    root.scale.multiplyScalar(10 / size.y);
  }

  const fitted = new THREE.Box3().setFromObject(root);
  const center = fitted.getCenter(new THREE.Vector3());
  root.position.set(x - (center.x - root.position.x), root.position.y - fitted.min.y, z - (center.z - root.position.z));
}
