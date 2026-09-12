import { describe, expect, it } from 'vitest';
import { latLngToWorldPosition } from '../../services/transform/latLngToWorldPosition';
import { hydrantWorldPosition } from './worldPosition';

describe('hydrantWorldPosition', () => {
  const origin = { lat: 38.9899314, lng: 141.1152492 };

  it('returns the plain lat/lng-derived position for a hydrant with no known overlap', () => {
    const hydrant = { id: 'hydrant_1-1', lat: 38.9863464631357, lng: 141.116522928934 };
    expect(hydrantWorldPosition(hydrant, origin)).toEqual(latLngToWorldPosition(hydrant.lat, hydrant.lng, origin));
  });

  it('shifts the known building-overlap hydrant (志羅山3番地) off its raw coordinate', () => {
    const hydrant = { id: 'hydrant_1-3', lat: 38.9885159157107, lng: 141.1160787797050 };
    const base = latLngToWorldPosition(hydrant.lat, hydrant.lng, origin);
    const corrected = hydrantWorldPosition(hydrant, origin);
    expect(corrected).not.toEqual(base);
    expect(Math.hypot(corrected.x - base.x, corrected.z - base.z)).toBeCloseTo(0.5, 5);
  });

  // hydrant_1-3 の修正をきっかけに、hiraizumi-town.glb の全建物メッシュに対して
  // 全消火栓を機械的に点検した際に見つかった、同種の建物めり込み(2026-09-12)。
  it.each([
    ['hydrant_1-37', 38.9928127329859, 141.107272325714, Math.hypot(-0.64, -4.858)],
    ['hydrant_1-46', 38.9865205710652, 141.118016301768, Math.hypot(-0.397, -0.304)],
    ['hydrant_1-53', 38.9913438179813, 141.115786495492, Math.hypot(0.459, 1.109)]
  ])('shifts the known building-overlap hydrant %s off its raw coordinate', (id, lat, lng, expectedMagnitude) => {
    const hydrant = { id, lat, lng };
    const base = latLngToWorldPosition(hydrant.lat, hydrant.lng, origin);
    const corrected = hydrantWorldPosition(hydrant, origin);
    expect(corrected).not.toEqual(base);
    expect(Math.hypot(corrected.x - base.x, corrected.z - base.z)).toBeCloseTo(expectedMagnitude, 5);
  });
});
