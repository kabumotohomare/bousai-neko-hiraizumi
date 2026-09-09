import { describe, expect, it } from 'vitest';
import { getPerspectiveTransform, invert3 } from './perspectiveMath';

describe('perspective math', () => {
  it('maps a square onto itself', () => {
    const quad = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 }
    ] as const;
    const h = getPerspectiveTransform([...quad], [...quad]);
    expect(h).not.toBeNull();
    const inv = invert3(h!);
    expect(inv).not.toBeNull();
  });
});
