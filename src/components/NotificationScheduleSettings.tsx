import React, { useEffect, useState } from 'react';
import { loadNotificationSchedules, saveNotificationSchedule, type NotificationSchedule } from '../services/notificationSchedules';
const labels = { birthday: 'Birthdays', event: 'Special events', prayer: 'Midweek prayer meeting', sunday: 'Sunday service', practice: 'Setlist assignment reminder' };
export function NotificationScheduleSettings() {
  const [rows, setRows] = useState<NotificationSchedule[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => { void loadNotificationSchedules().then(setRows).catch(e => setError(e.message)); }, []);
  const change = (kind: string, update: Partial<NotificationSchedule>) => setRows(rows => rows.map(row => row.kind === kind ? { ...row, ...update } : row));
  return <section className="space-y-4"><p className="text-sm text-slate-500">All times use Philippine time (Asia/Manila). Dates follow the birthday, service, or event in your records. Assignment reminders go only to assigned members; the other reminders go to all active accounts. Changes apply to reminders that have not been sent.</p>
    {error && <p role="alert" className="text-rose-600">{error}</p>}{notice && <p role="status" className="text-emerald-600">{notice}</p>}
    {!rows.length && !error && <p>Loading notification schedules…</p>}
    {rows.map(row => <form key={row.kind} aria-label={labels[row.kind]} className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700" onSubmit={async e => { e.preventDefault(); if (busy) return; setBusy(row.kind); setError(''); setNotice(''); try { await saveNotificationSchedule(row); setNotice(`${labels[row.kind]} schedule saved.`); } catch (e) { setError((e as Error).message); } finally { setBusy(''); } }}>
      <label className="flex items-center justify-between gap-3 font-semibold">{labels[row.kind]}<input type="checkbox" aria-label={`Enable ${labels[row.kind]}`} checked={row.enabled} onChange={e => change(row.kind, { enabled: e.target.checked })} /></label>
      <fieldset><legend className="mb-2 text-sm">Days allowed for sending</legend><div className="flex flex-wrap gap-2">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day, index) => <button key={day} type="button" aria-label={`${labels[row.kind]} ${day}`} aria-pressed={row.weekdays.includes(index)} className={`min-h-11 min-w-11 rounded-full border px-3 text-sm ${row.weekdays.includes(index) ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-500 text-slate-500'}`} onClick={() => change(row.kind, { weekdays: row.weekdays.includes(index) ? row.weekdays.filter(d => d !== index) : [...row.weekdays, index].sort() })}>{day}</button>)}</div></fieldset>
      <div className="flex flex-wrap gap-4"><label className="text-sm">Time<input required type="time" className="mt-1 block min-h-11 rounded-lg border border-slate-500 bg-transparent px-3" value={row.local_time.slice(0, 5)} onChange={e => change(row.kind, { local_time: e.target.value })} /></label>
      <label className="text-sm">When<select className="mt-1 block min-h-11 rounded-lg border border-slate-500 bg-white px-3 dark:bg-slate-900" value={row.days_before} onChange={e => change(row.kind, { days_before: Number(e.target.value) })}>{Array.from({ length: 31 }, (_, n) => <option key={n} value={n}>{n === 0 ? 'On the day' : n === 1 ? '1 day before' : `${n} days before`}</option>)}</select></label></div>
      {row.enabled && !row.weekdays.length && <p className="text-sm text-rose-600">Select at least one day, or turn off this reminder.</p>}
      <button type="submit" className="ui-primary" disabled={!!busy || (row.enabled && !row.weekdays.length)}>{busy === row.kind ? 'Saving…' : 'Save schedule'}</button>
    </form>)}
    <p className="text-xs text-slate-500">For a custom message on an exact date and time, use Admin announcements → Schedule. Phone delivery requires notification permission and an internet connection.</p>
  </section>;
}
