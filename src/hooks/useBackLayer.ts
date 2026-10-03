import { useEffect, useRef, useState } from 'react';
let nextLayer = 0;
const mountedLayers = new Set<string>();
export const isBackLayerMounted = (id: string) => mountedLayers.has(id);
/** Give a local screen its own browser-history entry before leaving its tab. */
export function useBackLayer(active: boolean, close: () => void) {
  const [id] = useState(() => `local-screen-${Date.now()}-${++nextLayer}`);
  const state = useRef({ active, close, pushed: false, consuming: false });
  state.current.active = active; state.current.close = close;
  const [, rerender] = useState(0);
  useEffect(() => {
    mountedLayers.add(id);
    const onPop = (event: PopStateEvent) => {
      const current = state.current;
      if (current.consuming) {
        current.consuming = false;
        event.stopImmediatePropagation();
        rerender(value => value + 1);
        return;
      }
      if (!current.active || !current.pushed) return;
      event.stopImmediatePropagation();
      current.pushed = false;
      current.close();
      // If closing is blocked by saving or a discard prompt, re-arm the entry.
      rerender(value => value + 1);
    };
    window.addEventListener('popstate', onPop, true);
    return () => { mountedLayers.delete(id); window.removeEventListener('popstate', onPop, true); };
  }, []);
  useEffect(() => {
    const current = state.current;
    if (active && !current.pushed && !current.consuming) {
      window.history.pushState({ ...window.history.state, localScreen: id }, '');
      current.pushed = true;
    } else if (!active && current.pushed) {
      current.pushed = false;
      if (window.history.state?.localScreen === id) {
        current.consuming = true;
        window.history.back();
      }
    }
  });
}
