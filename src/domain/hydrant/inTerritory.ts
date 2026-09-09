import { distanceXZ, Vec2 } from '../cat/territory';

export function isHydrantInTerritory(hydrantWorld: Vec2, catWorld: Vec2, radius: number): boolean {
  return distanceXZ(hydrantWorld, catWorld) <= radius;
}
