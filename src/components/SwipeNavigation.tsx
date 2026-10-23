import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { swipeDestination, swipeDirection } from '../utils/swipeNavigation';
import type { AppTab } from '../types';
interface Scope { key: symbol; tab: string; value: string; select: (value: string) => void }
interface ContextValue { register: (scope: Scope) => () => void; requested: (tab: string) => string | undefined }
const Context = createContext<ContextValue | null>(null);

/** One gesture recognizer for browsing. Native edge Back and local editing gestures keep priority. */
export function SwipeNavigationProvider({ currentTab, onNavigate, children }: { currentTab: AppTab; onNavigate: (tab: AppTab) => void; children: React.ReactNode }) {
  const latest = useRef({ currentTab, onNavigate }); latest.current = { currentTab, onNavigate };
  const scope = useRef<Scope | null>(null), requested = useRef<{ tab: string; value?: string } | null>(null);
  const register = useCallback((value: Scope) => {
    scope.current = value;
    if (requested.current?.tab === value.tab) requested.current = null;
    return () => { if (scope.current?.key === value.key) scope.current = null; };
  }, []);
  const context = useMemo(() => ({ register, requested: (tab: string) => requested.current?.tab === tab ? requested.current.value : undefined }), [register]);
  useEffect(() => {
    let start: { id: number; x: number; y: number; time: number } | null = null;
    let suppressClickUntil = 0;
    const blocked = () => Boolean(window.history.state?.localScreen || document.querySelector('[role="dialog"], [aria-modal="true"], [role="menu"], [data-tab-swipe-blocked="true"]'));
    const onStart = (event: TouchEvent) => {
      start = null;
      if (event.touches.length !== 1 || blocked() || latest.current.currentTab === 'settings') return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest('.qnlbc-app') || target.closest('input, textarea, select, [contenteditable="true"], form, audio, video, canvas, [data-no-swipe], [aria-label^="Reorder"], [aria-label^="Move song"]')) return;
      if (window.getSelection()?.toString()) return;
      for (let node: Element | null = target; node && !node.classList.contains('qnlbc-app'); node = node.parentElement) {
        if (node.scrollWidth > node.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(node).overflowX)) return;
      }
      const touch = event.touches[0];
      if (touch.clientX <= 32 || touch.clientX >= window.innerWidth - 32) return;
      start = { id: touch.identifier, x: touch.clientX, y: touch.clientY, time: performance.now() };
    };
    const onMove = (event: TouchEvent) => {
      if (!start) return;
      if (event.touches.length !== 1 || event.defaultPrevented) { start = null; return; }
      const touch = event.touches[0], dx = Math.abs(touch.clientX - start.x), dy = Math.abs(touch.clientY - start.y);
      if (dy > 12 && dy > dx) { start = null; return; }
      if (dx > 24 && dx > dy * 1.6 && event.cancelable) event.preventDefault();
    };
    const onEnd = (event: TouchEvent) => {
      const previous = start; start = null;
      if (!previous || blocked()) return;
      const touch = Array.from(event.changedTouches).find(t => t.identifier === previous.id);
      if (!touch) return;
      const direction = swipeDirection(previous.x, previous.y, touch.clientX, touch.clientY, window.innerWidth, performance.now() - previous.time);
      if (!direction) return;
      const active = scope.current?.tab === latest.current.currentTab ? scope.current : null;
      const destination = swipeDestination(latest.current.currentTab, active?.value, direction);
      if (!destination) return;
      suppressClickUntil = performance.now() + 350;
      if (event.cancelable) event.preventDefault();
      if (destination.tab === latest.current.currentTab && destination.subtab) active?.select(destination.subtab);
      else {
        requested.current = { tab: destination.tab, value: destination.subtab };
        latest.current.onNavigate(destination.tab);
      }
    };
    const onCancel = () => { start = null; };
    const onClick = (event: MouseEvent) => { if (performance.now() < suppressClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); } };
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd, { passive: false });
    document.addEventListener('touchcancel', onCancel);
    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('touchstart', onStart); document.removeEventListener('touchmove', onMove); document.removeEventListener('touchend', onEnd); document.removeEventListener('touchcancel', onCancel); document.removeEventListener('click', onClick, true);
    };
  }, []);
  return <Context.Provider value={context}>{children}</Context.Provider>;
}
export function useSwipeSubtabs<T extends string>(tab: AppTab, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const context = useContext(Context), key = useRef(Symbol('swipe-subtabs'));
  const [value, setValue] = useState<T>(() => (context?.requested(tab) as T) || initial);
  useEffect(() => context?.register({ key: key.current, tab, value, select: next => setValue(next as T) }), [context, tab, value]);
  return [value, setValue];
}
