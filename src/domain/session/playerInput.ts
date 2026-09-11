export interface PlayerInput {
  stickForward: number;
  stickTurn: number;
  keyForward: number;
  keyTurn: number;
  dash: boolean;
}

export interface PlayerPose {
  x: number;
  z: number;
  heading: number;
}

export function readPlayerAxes(input: PlayerInput): { forward: number; turn: number } {
  return {
    forward: Math.max(-1, Math.min(1, input.stickForward + input.keyForward)),
    turn: Math.max(-1, Math.min(1, input.stickTurn + input.keyTurn))
  };
}

export const DASH_STICK_DEADZONE = 0.12;
export const DASH_LATCH_GRACE_MS = 400;

export function isStickMoving(forward: number, turn: number, deadzone = DASH_STICK_DEADZONE): boolean {
  return Math.abs(forward) > deadzone || Math.abs(turn) > deadzone;
}

/** ボタン／Shift／スティック中のラッチのどれかが生きていればダッシュ。 */
export function resolveDashHeld(touch: boolean, shift: boolean, latched: boolean): boolean {
  return touch || shift || latched;
}

/**
 * モバイルでは「はしる」を押した指が、2本目の指でスティックを倒した瞬間に
 * pointercancel されることがある。その場合でも、直近にダッシュしていたなら
 * スティックを倒している間は走りを維持する。
 */
export function resolveDashLatch(input: {
  stickMoving: boolean;
  touchDash: boolean;
  msSinceTouchDash: number;
  graceMs?: number;
}): boolean {
  if (!input.stickMoving) {
    return false;
  }
  const graceMs = input.graceMs ?? DASH_LATCH_GRACE_MS;
  return input.touchDash || input.msSinceTouchDash <= graceMs;
}
