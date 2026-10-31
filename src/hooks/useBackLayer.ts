import { useEffect, useRef, useState } from 'react';
let nextLayer = 0;
const mountedLayers = new Set<string>();
const layerStack: string[] = [];
const removeLayer = (id: string) => { const index = layerStack.indexOf(id); if (index >= 0) layerStack.splice(index, 1); };
export const isBackLayerMounted = (id: string) => mountedLayers.has(id) && layerStack.includes(id);
const consumers = new WeakSet<Window>();
const pendingBack = new WeakMap<Window, { id: string; state: { consuming: boolean }; notify: () => void }>();
function installConsumer() {
  if (consumers.has(window)) return;
  consumers.add(window);
  window.addEventListener('popstate', event => {
    const pending = pendingBack.get(window);
    if (!pending) return;
    // Never consume the final app boundary during asynchronous panel cleanup.
    // Mobile Back may skip the expected parent history entry; let the exit guard
    // see that traversal and re-arm its confirmation instead of leaving at root.
    if (event.state?.appRoot || (!event.state?.tab && !event.state?.localScreen)) {
      pendingBack.delete(window); pending.state.consuming = false;
      if (mountedLayers.has(pending.id)) pending.notify();
      return;
    }
    event.stopImmediatePropagation();
    if (event.state?.localScreen && !isBackLayerMounted(event.state.localScreen)) { window.history.back(); return; }
    pendingBack.delete(window); pending.state.consuming = false;
    if (mountedLayers.has(pending.id)) pending.notify();
  }, true);
}
/** Give a local screen its own browser-history entry before leaving its tab. */
export function useBackLayer(active: boolean, close: () => void) {
  const [id] = useState(() => `local-screen-${Date.now()}-${++nextLayer}`);
  const state = useRef({ active, close, pushed: false, consuming: false });
  state.current.active = active; state.current.close = close;
  const [, rerender] = useState(0);
  useEffect(() => {
    installConsumer();
    mountedLayers.add(id);
    const onPop = (event: PopStateEvent) => {
      const current = state.current;
      if (current.consuming) {
        current.consuming = false;
        event.stopImmediatePropagation();
        rerender(value => value + 1);
        return;
      }
      if (!current.active || !current.pushed || layerStack.at(-1) !== id) return;
      event.stopImmediatePropagation();
      current.pushed = false;
      removeLayer(id);
      current.close();
      // If closing is blocked by saving or a discard prompt, re-arm the entry.
      rerender(value => value + 1);
    };
    window.addEventListener('popstate', onPop, true);
    return () => {
      mountedLayers.delete(id); removeLayer(id); window.removeEventListener('popstate', onPop, true);
      if (state.current.pushed && window.history.state?.localScreen === id) {
        state.current.pushed = false; state.current.consuming = true;
        pendingBack.set(window, { id, state: state.current, notify: () => rerender(value => value + 1) });
        window.history.back();
      }
    };
  }, []);
  useEffect(() => {
    const current = state.current;
    if (active && !current.pushed && !current.consuming) {
      window.history.pushState({ ...window.history.state, localScreen: id }, '');
      current.pushed = true;
      removeLayer(id); layerStack.push(id);
    } else if (!active && current.pushed) {
      current.pushed = false;
      removeLayer(id);
      if (window.history.state?.localScreen === id) {
        current.consuming = true;
        pendingBack.set(window, { id, state: current, notify: () => rerender(value => value + 1) });
        window.history.back();
      }
    }
  });
}
