import { describe, expect, it } from 'vitest';
import { applyBsc } from './adjust';

describe('applyBsc', () => {
  it('brightens rgb', () => {
    const [r] = applyBsc(10, 10, 10, 20, 0, 0);
    expect(r).toBeGreaterThan(10);
  });

  it('keeps mid gray on zero params', () => {
    expect(applyBsc(128, 128, 128, 0, 0, 0)).toEqual([128, 128, 128]);
  });
});
