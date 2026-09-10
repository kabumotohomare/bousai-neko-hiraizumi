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

  it('cancels an outward move and clamps onto the boundary circle', () => {
    const result = resolveTerritoryMove({ x: 9.8, z: 0 }, { x: 10.5, z: 0 }, center, 10);
    expect(result.bounced).toBe(true);
    expect(result.position.x).toBeCloseTo(9.999, 3);
    expect(result.position.z).toBe(0);
  });

  it('clamps along the attempted direction, allowing a tangential slide along the edge', () => {
    // 境界ぎりぎりから斜め方向へ出ようとした場合、外向き成分だけがクランプされ、
    // 接線方向には自然に滑れる（＝角度に応じた位置になる）。
    const result = resolveTerritoryMove({ x: 10, z: 0 }, { x: 10.3, z: 0.3 }, center, 10);
    expect(result.bounced).toBe(true);
    const distanceFromCenter = Math.hypot(result.position.x, result.position.z);
    expect(distanceFromCenter).toBeCloseTo(9.999, 3);
    expect(result.position.x).toBeGreaterThan(result.position.z);
  });

  describe('H8: repeated dash contact should not bounce', () => {
    it('does not snap back further than the frame travelled (no rubber-banding)', () => {
      // ダッシュ相当（1フレーム最大0.5m）で境界へ何度も突っ込んでも、
      // 実際の移動量より大きく中心側へスナップされてはいけない。
      const radius = 10;
      let pos = { x: 9.6, z: 0 };
      for (let frame = 0; frame < 20; frame += 1) {
        const attempted = { x: pos.x + 0.5, z: pos.z };
        const before = pos;
        const result = resolveTerritoryMove(before, attempted, center, radius);
        if (result.bounced) {
          const snapBack = before.x - result.position.x;
          // 押し戻し量は「今回試みた前進量(0.5m)」を超えてはならない。
          expect(snapBack).toBeLessThanOrEqual(0.5 + 1e-6);
        }
        pos = result.position;
      }
      // 最終的に境界のすぐ内側に落ち着く（暴れて中心側へ大きく戻っていない）。
      expect(pos.x).toBeGreaterThan(radius - 0.1);
      expect(pos.x).toBeLessThanOrEqual(radius);
    });
  });
});
