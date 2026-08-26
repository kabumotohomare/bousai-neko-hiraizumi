import { describe, expect, it } from 'vitest';
import { distance2d, latLngToWorldPosition } from './latLngToWorldPosition';

describe('latLngToWorldPosition', () => {
  it('returns origin as zero', () => {
    const origin = { lat: 38.9869, lng: 141.117 };
    expect(latLngToWorldPosition(origin.lat, origin.lng, origin)).toEqual({ x: 0, z: -0 });
  });

  it('moves east to positive x', () => {
    const origin = { lat: 38.9869, lng: 141.117 };
    const point = latLngToWorldPosition(origin.lat, origin.lng + 0.001, origin);
    expect(point.x).toBeGreaterThan(0);
  });

  it('calculates 2d distance', () => {
    expect(distance2d({ x: 0, z: 0 }, { x: 3, z: 4 })).toBe(5);
  });
});
