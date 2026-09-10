export interface Vec2 {
  x: number;
  z: number;
}

export function distanceXZ(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

export function isInsideTerritory(player: Vec2, center: Vec2, radius: number): boolean {
  return distanceXZ(player, center) <= radius;
}

const BOUNDARY_MARGIN_M = 1e-3;

/**
 * 境界の外へ出ようとしたら、中心方向へ固定距離だけ押し戻すのではなく、
 * 境界の円周上（のわずか内側）へクランプする。
 *
 * 以前は previous から中心方向へ 0.75m 固定で押し戻していたため、ダッシュ中
 * （1フレームの移動量は最大でも約0.5m）に境界へ触れると、実際の移動量より
 * 大きく中心側へスナップされ、「跳ね返る」ように見えていた（縄張りバウンド）。
 * 円周上へクランプする方式なら、境界に沿って移動する分には previous とほぼ
 * 同じ位置に留まり、急なスナップは起きない。
 */
export function resolveTerritoryMove(
  previous: Vec2,
  attempted: Vec2,
  center: Vec2,
  radius: number
): { position: Vec2; bounced: boolean } {
  if (isInsideTerritory(attempted, center, radius)) {
    return { position: attempted, bounced: false };
  }

  const dx = attempted.x - center.x;
  const dz = attempted.z - center.z;
  const length = Math.hypot(dx, dz) || 1;
  const clampedRadius = Math.max(radius - BOUNDARY_MARGIN_M, 0);

  return {
    position: {
      x: center.x + (dx / length) * clampedRadius,
      z: center.z + (dz / length) * clampedRadius
    },
    bounced: true
  };
}
