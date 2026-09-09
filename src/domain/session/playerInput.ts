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
