import { describe, expect, it } from 'vitest';
import { findInspectableHydrantId } from './inspect';

describe('findInspectableHydrantId', () => {
  const hydrants = [
    { id: 'a', position: { x: 3, z: 0 } },
    { id: 'b', position: { x: 1, z: 0 } }
  ];

  it('returns the nearest uninspected hydrant within range', () => {
    expect(findInspectableHydrantId({ x: 0, z: 0 }, hydrants, [], 2)).toBe('b');
  });

  it('skips already inspected hydrants', () => {
    expect(findInspectableHydrantId({ x: 0, z: 0 }, hydrants, ['b'], 4)).toBe('a');
  });

  it('returns null when nothing is close enough', () => {
    expect(findInspectableHydrantId({ x: 0, z: 0 }, hydrants, [], 0.5)).toBe(null);
  });
});
