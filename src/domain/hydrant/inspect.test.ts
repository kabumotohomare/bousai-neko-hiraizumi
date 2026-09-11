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

  describe('H7: hysteresis keeps the currently-selected hydrant a little longer', () => {
    const single = [{ id: 'b', position: { x: 1, z: 0 } }];

    it('keeps the previous hydrant selected just past the normal radius', () => {
      // b は x=1 にあり、player が x=2.3 まで進むと通常半径(2)からは外れる。
      // 直前まで b が選択中だったなら、余裕(exitRadiusMeters)の範囲内は維持する。
      const result = findInspectableHydrantId({ x: 2.3, z: 0 }, single, [], 2, {
        previousInspectableId: 'b',
        exitRadiusMeters: 2.6
      });
      expect(result).toBe('b');
    });

    it('drops the previous hydrant once outside the exit radius too', () => {
      const result = findInspectableHydrantId({ x: 3.7, z: 0 }, single, [], 2, {
        previousInspectableId: 'b',
        exitRadiusMeters: 2.6
      });
      expect(result).toBe(null);
    });

    it('does not widen the entry radius for a hydrant that was not already selected', () => {
      // previousInspectableId は 'a' なので、'b'(x=1) は通常半径(2)のままであるべき。
      // player を x=-1.3 に置くと a までは4.3m(範囲外)、b までは2.3m
      // （通常半径2は超えるが、拡張半径2.6以内）になる。
      // b が拡張半径の恩恵を受けてしまうなら誤って選択されてしまう。
      const result = findInspectableHydrantId({ x: -1.3, z: 0 }, hydrants, [], 2, {
        previousInspectableId: 'a',
        exitRadiusMeters: 2.6
      });
      expect(result).toBe(null);
    });
  });
});
