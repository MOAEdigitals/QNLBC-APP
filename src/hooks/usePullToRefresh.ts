import { useEffect, useRef, useState } from 'react';
import { hasActiveBackLayer } from './useBackLayer';
import { installPullToRefresh } from '../utils/pullToRefresh';

const localRefreshers = new Set<() => Promise<unknown>>();
export async function refreshLocalScreens() { await Promise.all([...localRefreshers].map(refresh => refresh())); }
export function useScreenRefresh(refresh: () => Promise<unknown>) {
  const latest = useRef(refresh); latest.current = refresh;
  useEffect(() => {
    const run = () => latest.current();
    localRefreshers.add(run);
    return () => { localRefreshers.delete(run); };
  }, []);
}

export function usePullToRefresh(refresh: () => Promise<unknown>, enabled: boolean) {
  const latest = useRef({ refresh, enabled }); latest.current = { refresh, enabled };
  const [state, setState] = useState({ distance: 0, refreshing: false });
  useEffect(() => installPullToRefresh({
    enabled: () => latest.current.enabled,
    blocked: hasActiveBackLayer,
    refresh: () => latest.current.refresh(),
    progress: (distance, refreshing) => setState(previous => previous.distance === distance && previous.refreshing === refreshing ? previous : { distance, refreshing }),
  }), []);
  return state;
}
