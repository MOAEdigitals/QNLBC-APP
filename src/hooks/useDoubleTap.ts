import { useRef } from 'react';
import type { PointerEvent, MouseEvent } from 'react';

/** Touch/pen double-taps, with movement rejection and desktop double-click support. */
export function useDoubleTap(action: () => void) {
  const candidate = useRef<{ x: number; y: number; time: number; id: number } | null>(null);
  const lastTap = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastTouchAction = useRef(-Infinity);
  const reset = () => { candidate.current = null; lastTap.current = null; };
  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (event.pointerType === 'mouse') return;
      if (!event.isPrimary || (event.target as HTMLElement).closest('button, input, select, textarea, a')) { reset(); return; }
      candidate.current = { x: event.clientX, y: event.clientY, time: event.timeStamp, id: event.pointerId };
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const start = candidate.current;
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 12) reset();
    },
    onPointerUp(event: PointerEvent<HTMLElement>) {
      const start = candidate.current;
      candidate.current = null;
      if (!start || start.id !== event.pointerId || event.timeStamp - start.time > 250) { lastTap.current = null; return; }
      const previous = lastTap.current;
      if (previous && event.timeStamp - previous.time <= 320 && Math.hypot(event.clientX - previous.x, event.clientY - previous.y) <= 28) {
        event.preventDefault();
        lastTap.current = null;
        lastTouchAction.current = event.timeStamp;
        action();
      } else lastTap.current = { x: event.clientX, y: event.clientY, time: event.timeStamp };
    },
    onPointerCancel: reset,
    onDoubleClick(event: MouseEvent<HTMLElement>) {
      // Browsers may synthesize dblclick after a touch double-tap.
      if (event.timeStamp - lastTouchAction.current < 600 || (event.target as HTMLElement).closest('button, input, select, textarea, a')) return;
      event.preventDefault();
      action();
    },
  };
}
