import React, { useState } from 'react';
import { User } from 'lucide-react';

export function PersonAvatar({ name, src }: { name?: string; src?: string }) {
  const [failed, setFailed] = useState<string | undefined>();
  return <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-slate-500 dark:text-slate-400">
    {src && failed !== src ? <img src={src} alt={`${name || 'Member'} profile picture`} referrerPolicy="no-referrer" onError={() => setFailed(src)} className="h-full w-full object-cover" /> : <User className="h-4 w-4" aria-hidden="true" />}
  </span>;
}
