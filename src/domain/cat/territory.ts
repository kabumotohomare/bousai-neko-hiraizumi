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

export function resolveTerritoryMove(
  previous: Vec2,
  attempted: Vec2,
  center: Vec2,
  radius: number,
  pushMeters = 0.75
): { position: Vec2; bounced: boolean } {
  if (isInsideTerritory(attempted, center, radius)) {
    return { position: attempted, bounced: false };
  }

  const dx = center.x - previous.x;
  const dz = center.z - previous.z;
  const length = Math.hypot(dx, dz) || 1;
  const pushed = {
    x: previous.x + (dx / length) * pushMeters,
    z: previous.z + (dz / length) * pushMeters
  };

  if (isInsideTerritory(pushed, center, radius)) {
    return { position: pushed, bounced: true };
  }

  const inward = Math.max(radius - 0.5, 0);
  return {
    position: {
      x: center.x - (dx / length) * inward,
      z: center.z - (dz / length) * inward
    },
    bounced: true
  };
}
