import React, { useState } from 'react';
import { SwitchRow } from './SwitchRow';
import { notificationSoundEnabled, setNotificationSoundEnabled, playNotificationSound } from '../utils/notificationSound';
export function NotificationSoundSettings({ userId }: { userId: string }) {
  const [enabled, setEnabled] = useState(() => notificationSoundEnabled(userId));
  const [message, setMessage] = useState('');
  return <section aria-label="In-app sound" className="settings-sound-section">
    <SwitchRow label="Notification sound" checked={enabled} onChange={checked => { setEnabled(checked); setNotificationSoundEnabled(userId, checked); setMessage(''); }} />
    <button type="button" disabled={!enabled} onClick={async () => setMessage(await playNotificationSound(userId, true) ? 'Test sound played.' : 'Sound is blocked by this browser or device. Check its sound settings.')} className="settings-inline-action">Test sound</button>
    {message && <p role="status" className="text-xs text-slate-500 dark:text-slate-400">{message}</p>}
  </section>;
}
