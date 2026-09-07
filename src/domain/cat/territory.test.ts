import { describe, expect, it } from 'vitest';
import { isInsideTerritory, resolveTerritoryMove } from './territory';

describe('territory', () => {
  const center = { x: 0, z: 0 };

  it('accepts a point inside the radius', () => {
    expect(isInsideTerritory({ x: 3, z: 4 }, center, 10)).toBe(true);
  });

  it('rejects a point outside the radius', () => {
    expect(isInsideTerritory({ x: 8, z: 0 }, center, 5)).toBe(false);
  });

  it('keeps a legal move', () => {
    const result = resolveTerritoryMove({ x: 0, z: 0 }, { x: 2, z: 0 }, center, 10);
    expect(result.bounced).toBe(false);
    expect(result.position).toEqual({ x: 2, z: 0 });
  });

  it('cancels an outward move and pushes back toward the center', () => {
    const result = resolveTerritoryMove({ x: 9.8, z: 0 }, { x: 10.5, z: 0 }, center, 10, 0.75);
    expect(result.bounced).toBe(true);
    expect(result.position.x).toBeCloseTo(9.05);
    expect(result.position.z).toBe(0);
  });
});
