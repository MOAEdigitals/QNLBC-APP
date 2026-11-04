import React from 'react';
import { ArrowDown, Loader2 } from 'lucide-react';

export function PullToRefreshIndicator({ distance, refreshing }: { distance: number; refreshing: boolean }) {
  if (!distance && !refreshing) return null;
  return <div className="app-refresh-indicator" role="status" aria-live="polite" style={{ transform: `translate(-50%, ${Math.min(distance, 64)}px)` }}>
    {refreshing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowDown className="h-4 w-4" aria-hidden="true" />}
    <span>{refreshing ? 'Refreshing…' : distance >= 64 ? 'Release to refresh' : 'Pull to refresh'}</span>
  </div>;
}
