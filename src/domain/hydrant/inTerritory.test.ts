import { describe, expect, it } from 'vitest';
import { isHydrantInTerritory } from './inTerritory';

describe('isHydrantInTerritory', () => {
  const catWorld = { x: 0, z: 0 };

  it('includes a hydrant on the radius', () => {
    expect(isHydrantInTerritory({ x: 160, z: 0 }, catWorld, 160)).toBe(true);
  });

  it('excludes a hydrant just outside the radius', () => {
    expect(isHydrantInTerritory({ x: 161, z: 0 }, catWorld, 160)).toBe(false);
  });
});
