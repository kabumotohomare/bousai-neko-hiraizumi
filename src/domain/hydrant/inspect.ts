import { distanceXZ, Vec2 } from '../cat/territory';

export interface HydrantPoint {
  id: string;
  position: Vec2;
}

export interface FindInspectableOptions {
  /** 直前まで選択されていた点検対象のID。ヒステリシスの exitRadiusMeters を適用する対象。 */
  previousInspectableId?: string | null;
  /**
   * 既に選択中の点検対象を「維持」する半径。inspectRadiusMeters より広く取ることで、
   * タッチ操作でボタンを押そうとしている間にわずかに動いて半径をまたいだだけで
   * 選択が消える（＝点検を「通り過ぎ」たように見える）ことを防ぐ（H7）。
   * 新規に選択される半径(inspectRadiusMeters)自体は変えない。
   */
  exitRadiusMeters?: number;
}

export function findInspectableHydrantId(
  player: Vec2,
  hydrants: HydrantPoint[],
  inspectedHydrantIds: string[],
  inspectRadiusMeters: number,
  options: FindInspectableOptions = {}
): string | null {
  const { previousInspectableId = null, exitRadiusMeters = inspectRadiusMeters } = options;
  const effectiveExitRadius = Math.max(exitRadiusMeters, inspectRadiusMeters);

  let nearestId: string | null = null;
  let nearestDistance = Infinity;

  for (const hydrant of hydrants) {
    if (inspectedHydrantIds.includes(hydrant.id)) {
      continue;
    }

    const distance = distanceXZ(player, hydrant.position);
    const radius = hydrant.id === previousInspectableId ? effectiveExitRadius : inspectRadiusMeters;
    if (distance <= radius && distance < nearestDistance) {
      nearestDistance = distance;
      nearestId = hydrant.id;
    }
  }

  return nearestId;
}
