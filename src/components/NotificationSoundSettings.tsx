import React, { useState } from 'react';
import { notificationSoundEnabled, setNotificationSoundEnabled, playNotificationSound } from '../utils/notificationSound';
export function NotificationSoundSettings({ userId }: { userId: string }) {
  const [enabled, setEnabled] = useState(() => notificationSoundEnabled(userId));
  const [message, setMessage] = useState('');
  return <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
    <label className="flex items-center justify-between gap-3 font-semibold text-sm">Notification sound<input type="checkbox" checked={enabled} onChange={event => { setEnabled(event.target.checked); setNotificationSoundEnabled(userId, event.target.checked); setMessage(''); }} /></label>
    <p className="text-xs text-slate-500 dark:text-slate-400">Play a chime for new notifications while this app is open. Android system notifications use your phone’s notification sound and mute settings.</p>
    <button type="button" disabled={!enabled} onClick={async () => setMessage(await playNotificationSound(userId, true) ? 'Test sound played.' : 'Sound is blocked by this browser or device. Check its sound settings.')} className="min-h-11 rounded-xl border border-slate-300 dark:border-slate-600 px-3 text-sm disabled:opacity-50">Test sound</button>
    {message && <p role="status" className="text-xs text-slate-500 dark:text-slate-400">{message}</p>}
  </div>;
}
