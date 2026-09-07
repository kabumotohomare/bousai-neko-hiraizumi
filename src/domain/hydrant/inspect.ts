import { distanceXZ, Vec2 } from '../cat/territory';

export interface HydrantPoint {
  id: string;
  position: Vec2;
}

export function findInspectableHydrantId(
  player: Vec2,
  hydrants: HydrantPoint[],
  inspectedHydrantIds: string[],
  inspectRadiusMeters: number
): string | null {
  let nearestId: string | null = null;
  let nearestDistance = inspectRadiusMeters;

  for (const hydrant of hydrants) {
    if (inspectedHydrantIds.includes(hydrant.id)) {
      continue;
    }

    const distance = distanceXZ(player, hydrant.position);
    if (distance <= nearestDistance) {
      nearestDistance = distance;
      nearestId = hydrant.id;
    }
  }

  return nearestId;
}
