import React from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { BottomSheet } from './BottomSheet';
import { setlistReadiness } from '../utils/setlistDraft';
import type { Setlist, Song } from '../types';

export function SetlistReadiness({ setlist, songs, offline = false, onClose }: { setlist: Setlist; songs: Song[]; offline?: boolean; onClose: () => void }) {
  const issues = setlistReadiness(setlist, songs, !offline);
  return <BottomSheet open title="Setlist readiness" onClose={onClose}>
    <div className="px-4 pb-5">
      <p className="flex items-center gap-2 py-3 text-sm font-semibold">{issues.length ? <AlertCircle className="h-4 w-4 text-amber-500" /> : <CheckCircle className="h-4 w-4 text-emerald-500" />}{issues.length ? `${issues.length} items to review` : offline ? 'Assignments and lyrics are ready' : 'Assignments, lyrics and tracks are ready'}</p>
      {offline && <p className="pb-3 text-xs text-slate-500">Practice tracks are checked online.</p>}
      {issues.length > 0 && <ul className="divide-y divide-slate-200 dark:divide-slate-700">{issues.map((issue, index) => <li key={index} className="flex items-start justify-between gap-4 py-3 text-sm"><span>{issue.label}</span><span className="text-right text-slate-500 dark:text-slate-400">{issue.detail}</span></li>)}</ul>}
    </div>
  </BottomSheet>;
}
