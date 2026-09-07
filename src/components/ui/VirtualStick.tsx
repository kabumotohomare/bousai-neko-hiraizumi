import { PointerEvent, useCallback, useRef } from 'react';

interface VirtualStickProps {
  onChange: (forward: number, turn: number) => void;
}

const DEADZONE = 0.12;

export function VirtualStick({ onChange }: VirtualStickProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const knobRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);

  const reset = useCallback(() => {
    pointerIdRef.current = null;
    if (knobRef.current) {
      knobRef.current.style.transform = 'translate(0px, 0px)';
    }
    onChange(0, 0);
  }, [onChange]);

  const applyPointer = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const root = rootRef.current;
      const knob = knobRef.current;
      if (!root || !knob) {
        return;
      }

      const rect = root.getBoundingClientRect();
      const radius = rect.width / 2;
      const dx = event.clientX - (rect.left + radius);
      const dy = event.clientY - (rect.top + radius);
      const distance = Math.hypot(dx, dy);
      const limited = Math.min(distance, radius * 0.72);
      const angle = Math.atan2(dy, dx);
      const knobX = Math.cos(angle) * limited;
      const knobY = Math.sin(angle) * limited;
      knob.style.transform = `translate(${knobX}px, ${knobY}px)`;

      const nx = distance < 1 ? 0 : dx / radius;
      const ny = distance < 1 ? 0 : dy / radius;
      const turn = Math.abs(nx) < DEADZONE ? 0 : Math.max(-1, Math.min(1, nx));
      const forward = Math.abs(ny) < DEADZONE ? 0 : Math.max(-1, Math.min(1, -ny));
      onChange(forward, turn);
    },
    [onChange]
  );

  return (
    <div
      ref={rootRef}
      className="virtual-stick"
      role="application"
      aria-label="移動スティック"
      onPointerDown={(event) => {
        pointerIdRef.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        applyPointer(event);
      }}
      onPointerMove={(event) => {
        if (pointerIdRef.current !== event.pointerId) {
          return;
        }
        applyPointer(event);
      }}
      onPointerUp={reset}
      onPointerCancel={reset}
    >
      <div ref={knobRef} className="virtual-stick__knob" />
    </div>
  );
}
