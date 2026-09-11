import { describe, expect, it } from 'vitest';
import { resolveDashHeld, resolveDashLatch } from './playerInput';

describe('resolveDashHeld', () => {
  it('is true when any source is on', () => {
    expect(resolveDashHeld(true, false, false)).toBe(true);
    expect(resolveDashHeld(false, true, false)).toBe(true);
    expect(resolveDashHeld(false, false, true)).toBe(true);
    expect(resolveDashHeld(false, false, false)).toBe(false);
  });
});

describe('resolveDashLatch', () => {
  it('clears when the stick is idle', () => {
    expect(
      resolveDashLatch({ stickMoving: false, touchDash: true, msSinceTouchDash: 0 })
    ).toBe(false);
  });

  it('stays on while the dash button is held and the stick moves', () => {
    expect(
      resolveDashLatch({ stickMoving: true, touchDash: true, msSinceTouchDash: 0 })
    ).toBe(true);
  });

  it('survives a pointercancel shortly after dash if the stick is already moving', () => {
    expect(
      resolveDashLatch({ stickMoving: true, touchDash: false, msSinceTouchDash: 120 })
    ).toBe(true);
  });

  it('does not sprint from a stick-only gesture after the grace window', () => {
    expect(
      resolveDashLatch({ stickMoving: true, touchDash: false, msSinceTouchDash: 800 })
    ).toBe(false);
  });
});
