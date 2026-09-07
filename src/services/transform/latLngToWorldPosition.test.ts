import { describe, expect, it } from 'vitest';
import { distance2d, headingDegToRotationY, latLngToWorldPosition, worldPositionToLatLng } from './latLngToWorldPosition';

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

  it('moves north to negative z', () => {
    const origin = { lat: 38.9869, lng: 141.117 };
    const point = latLngToWorldPosition(origin.lat + 0.001, origin.lng, origin);
    expect(point.z).toBeLessThan(0);
  });

  it('places 38.988N 141.114E south-west of the S02 origin', () => {
    const origin = { lat: 38.9899314, lng: 141.1152492 };
    const point = latLngToWorldPosition(38.988, 141.114, origin);
    expect(point.x).toBeLessThan(0);
    expect(point.z).toBeGreaterThan(0);
    expect(point.x).toBeCloseTo(-107.9, 0);
    expect(point.z).toBeCloseTo(215.0, 0);
  });

  it('round-trips world coordinates back to lat/lng', () => {
    const origin = { lat: 38.9899314, lng: 141.1152492 };
    const world = latLngToWorldPosition(38.988, 141.114, origin);
    const restored = worldPositionToLatLng(world.x, world.z, origin);
    expect(restored.lat).toBeCloseTo(38.988, 6);
    expect(restored.lng).toBeCloseTo(141.114, 6);
  });

  it('converts east-of-north heading to negative yaw', () => {
    expect(headingDegToRotationY(0)).toBeCloseTo(0);
    expect(headingDegToRotationY(90)).toBeCloseTo(-Math.PI / 2);
  });
});
