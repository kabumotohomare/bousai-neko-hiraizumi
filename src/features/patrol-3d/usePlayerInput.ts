import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DASH_LATCH_GRACE_MS,
  isStickMoving,
  PlayerInput,
  resolveDashHeld,
  resolveDashLatch
} from '../../domain/session/playerInput';

export function usePlayerInput() {
  const inputRef = useRef<PlayerInput>({
    stickForward: 0,
    stickTurn: 0,
    keyForward: 0,
    keyTurn: 0,
    dash: false
  });
  const touchDashRef = useRef(false);
  const shiftDashRef = useRef(false);
  const dashLatchRef = useRef(false);
  const dashPointerIdRef = useRef<number | null>(null);
  const lastTouchDashAtRef = useRef(0);
  const [dashing, setDashing] = useState(false);

  const applyDash = useCallback(() => {
    const next = resolveDashHeld(touchDashRef.current, shiftDashRef.current, dashLatchRef.current);
    inputRef.current.dash = next;
    setDashing((prev) => (prev === next ? prev : next));
  }, []);

  const setStick = useCallback(
    (forward: number, turn: number) => {
      inputRef.current.stickForward = forward;
      inputRef.current.stickTurn = turn;
      dashLatchRef.current = resolveDashLatch({
        stickMoving: isStickMoving(forward, turn),
        touchDash: touchDashRef.current,
        msSinceTouchDash: performance.now() - lastTouchDashAtRef.current,
        graceMs: DASH_LATCH_GRACE_MS
      });
      applyDash();
    },
    [applyDash]
  );

  const setDash = useCallback(
    (dash: boolean, pointerId?: number) => {
      touchDashRef.current = dash;
      if (dash) {
        lastTouchDashAtRef.current = performance.now();
        if (pointerId !== undefined) {
          dashPointerIdRef.current = pointerId;
        }
      } else if (pointerId === undefined || dashPointerIdRef.current === pointerId) {
        dashPointerIdRef.current = null;
      }
      applyDash();
    },
    [applyDash]
  );

  useEffect(() => {
    const pressed = new Set<string>();

    const syncKeys = () => {
      const forward =
        (pressed.has('KeyW') || pressed.has('ArrowUp') ? 1 : 0) +
        (pressed.has('KeyS') || pressed.has('ArrowDown') ? -1 : 0);
      const turn =
        (pressed.has('KeyD') || pressed.has('ArrowRight') ? 1 : 0) +
        (pressed.has('KeyA') || pressed.has('ArrowLeft') ? -1 : 0);
      inputRef.current.keyForward = Math.max(-1, Math.min(1, forward));
      inputRef.current.keyTurn = Math.max(-1, Math.min(1, turn));
      shiftDashRef.current = pressed.has('ShiftLeft') || pressed.has('ShiftRight');
      applyDash();
    };

    const onDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        return;
      }
      if (
        event.code === 'ArrowUp' ||
        event.code === 'ArrowDown' ||
        event.code === 'ArrowLeft' ||
        event.code === 'ArrowRight'
      ) {
        event.preventDefault();
      }
      pressed.add(event.code);
      syncKeys();
    };

    const onUp = (event: KeyboardEvent) => {
      pressed.delete(event.code);
      syncKeys();
    };

    const onPointerEnd = (event: PointerEvent) => {
      if (dashPointerIdRef.current !== event.pointerId) {
        return;
      }
      dashPointerIdRef.current = null;
      touchDashRef.current = false;
      dashLatchRef.current = resolveDashLatch({
        stickMoving: isStickMoving(inputRef.current.stickForward, inputRef.current.stickTurn),
        touchDash: false,
        msSinceTouchDash: performance.now() - lastTouchDashAtRef.current,
        graceMs: DASH_LATCH_GRACE_MS
      });
      applyDash();
    };

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('pointerup', onPointerEnd);
    window.addEventListener('pointercancel', onPointerEnd);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('pointerup', onPointerEnd);
      window.removeEventListener('pointercancel', onPointerEnd);
    };
  }, [applyDash]);

  return { inputRef, setStick, setDash, dashing };
}
