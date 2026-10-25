import { useEffect, useRef } from 'react';
import { swipeDirection } from '../../utils/swipeNavigation';

/** The calendar owns interior horizontal gestures; vertical scrolling and edge Back stay native. */
export function useCalendarSwipe(changeMonth: (direction: 1 | -1) => void) {
  const ref = useRef<HTMLElement>(null);
  const latest = useRef(changeMonth);
  latest.current = changeMonth;
  useEffect(() => {
    const calendar = ref.current;
    if (!calendar) return;
    let start: { id: number; x: number; y: number; time: number } | null = null;
    let suppressClickUntil = 0;
    const cancel = () => { start = null; };
    const begin = (event: TouchEvent) => {
      cancel();
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      if (touch.clientX <= 32 || touch.clientX >= window.innerWidth - 32) return;
      start = { id: touch.identifier, x: touch.clientX, y: touch.clientY, time: performance.now() };
    };
    const move = (event: TouchEvent) => {
      if (!start) return;
      if (event.touches.length !== 1) { cancel(); return; }
      const touch = event.touches[0];
      if (touch.identifier !== start.id) { cancel(); return; }
      const dx = Math.abs(touch.clientX - start.x), dy = Math.abs(touch.clientY - start.y);
      if (dy > 12 && dy > dx) { cancel(); return; }
      if (dx > 24 && dx > dy * 1.6 && event.cancelable) event.preventDefault();
    };
    const end = (event: TouchEvent) => {
      const previous = start;
      cancel();
      if (!previous) return;
      const touch = Array.from(event.changedTouches).find(value => value.identifier === previous.id);
      if (!touch) return;
      const direction = swipeDirection(previous.x, previous.y, touch.clientX, touch.clientY, window.innerWidth, performance.now() - previous.time);
      if (!direction) return;
      suppressClickUntil = performance.now() + 350;
      if (event.cancelable) event.preventDefault();
      latest.current(direction);
    };
    const click = (event: MouseEvent) => {
      if (performance.now() < suppressClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    calendar.addEventListener('touchstart', begin, { passive: true });
    calendar.addEventListener('touchmove', move, { passive: false });
    calendar.addEventListener('touchend', end, { passive: false });
    calendar.addEventListener('touchcancel', cancel);
    calendar.addEventListener('click', click, true);
    return () => {
      calendar.removeEventListener('touchstart', begin);
      calendar.removeEventListener('touchmove', move);
      calendar.removeEventListener('touchend', end);
      calendar.removeEventListener('touchcancel', cancel);
      calendar.removeEventListener('click', click, true);
    };
  }, []);
  return ref;
}
