import { describe, expect, it } from 'vitest';
import { toRoadRibbon } from './toRoadRibbon';

describe('toRoadRibbon', () => {
  it('builds an east-facing strip with an upward normal winding', () => {
    const ribbon = toRoadRibbon(
      [
        { x: 0, z: 0 },
        { x: 10, z: 0 }
      ],
      4,
      0.02
    );

    expect(ribbon.positions).toHaveLength(12);
    expect(ribbon.indices).toEqual([0, 1, 2, 1, 3, 2]);
    expect(ribbon.positions[1]).toBeCloseTo(0.02);
    expect(ribbon.positions[2]).toBeCloseTo(-2);
    expect(ribbon.positions[5]).toBeCloseTo(2);
  });

  it('increases V along the path so the texture does not stretch', () => {
    const ribbon = toRoadRibbon(
      [
        { x: 0, z: 0 },
        { x: 0, z: -8 }
      ],
      4
    );

    expect(ribbon.uvs[1]).toBeCloseTo(0);
    expect(ribbon.uvs[5]).toBeCloseTo(1);
  });

  it('returns an empty mesh for a degenerate path', () => {
    expect(toRoadRibbon([{ x: 0, z: 0 }], 4)).toEqual({
      positions: [],
      uvs: [],
      indices: []
    });
  });
});
