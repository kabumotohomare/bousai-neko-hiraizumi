import { useCallback, useEffect, useRef } from 'react';
import { PlayerInput } from '../../domain/session/playerInput';

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

  const applyDash = useCallback(() => {
    inputRef.current.dash = touchDashRef.current || shiftDashRef.current;
  }, []);

  const setStick = useCallback((forward: number, turn: number) => {
    inputRef.current.stickForward = forward;
    inputRef.current.stickTurn = turn;
  }, []);

  const setDash = useCallback(
    (dash: boolean) => {
      touchDashRef.current = dash;
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

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [applyDash]);

  return { inputRef, setStick, setDash };
}
