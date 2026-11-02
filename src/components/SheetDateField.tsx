import React, { useId, useRef, useState } from 'react';
import { Calendar, Clock } from 'lucide-react';
import { BottomSheet } from './BottomSheet';
import { SheetSelect } from './SheetSelect';

export function SheetDateField({ type = 'date', value, defaultValue, onChange, disabled, required, id, name, form, className = '', min, max, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  const autoId = useId();
  const root = useRef<HTMLSpanElement>(null);
  const [local, setLocal] = useState(String(defaultValue || ''));
  const selected = String(value ?? local);
  const [open, setOpen] = useState(false), [title, setTitle] = useState(type === 'time' ? 'Time' : 'Date');
  const [date, setDate] = useState(''), [time, setTime] = useState('09:00'), [page, setPage] = useState({ month: 0, year: 2026 });
  const show = () => {
    if (disabled) return;
    const now = new Date(), day = selected.slice(0, 10);
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(day);
    const outer = root.current?.closest('label');
    const label = outer ? [...outer.childNodes].filter(node => node !== root.current).map(node => node.textContent || '').join(' ').trim() : id ? [...document.querySelectorAll('label')].find(label => label.htmlFor === id)?.textContent : '';
    setTitle(props['aria-label'] || label || (type === 'time' ? 'Time' : 'Date'));
    setDate(valid ? day : ''); setTime(type === 'time' ? selected.slice(0, 5) || '09:00' : selected.slice(11, 16) || '09:00');
    setPage({ year: valid ? Number(day.slice(0, 4)) : now.getFullYear(), month: valid ? Number(day.slice(5, 7)) - 1 : now.getMonth() }); setOpen(true);
  };
  const commit = (next: string) => { setLocal(next); onChange?.({ target: { value: next }, currentTarget: { value: next } } as React.ChangeEvent<HTMLInputElement>); setOpen(false); };
  const label = selected ? type === 'time' ? new Date(`2000-01-01T${selected.slice(0,5)}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : new Date(`${selected.slice(0,10)}T12:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + (type === 'datetime-local' ? ` · ${selected.slice(11,16)}` : '') : type === 'time' ? 'Choose time' : 'Choose date';
  const first = new Date(page.year, page.month, 1).getDay(), days = new Date(page.year, page.month + 1, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  const minimum = min ? String(min) : '', maximum = max ? String(max) : '';
  const invalid = (next: string) => !!((minimum && next < minimum) || (maximum && next > maximum));
  const hours = Number(time.slice(0,2)), minutes = time.slice(3,5) || '00';
  const setHour = (hour: number) => setTime(`${pad(hour)}:${minutes}`);
  const yearNow = new Date().getFullYear();
  return <span ref={root} className="ui-sheet-select-root">
    <button {...props as unknown as React.ButtonHTMLAttributes<HTMLButtonElement>} type="button" id={id || autoId} disabled={disabled} className={`ui-sheet-select ${className}`} aria-required={required || undefined} aria-haspopup="dialog" aria-expanded={open} onClick={show}><span className="min-w-0 flex-1 truncate">{label}</span>{type === 'time' ? <Clock className="h-4 w-4 shrink-0" /> : <Calendar className="h-4 w-4 shrink-0" />}</button>
    <input type="text" className="ui-select-validation" tabIndex={-1} aria-hidden="true" data-field-type={type} value={selected} name={name} form={form} required={required} disabled={disabled} onChange={() => {}} onInvalid={event => { event.preventDefault(); show(); }} />
    <BottomSheet open={open} title={title} onClose={() => setOpen(false)}>
      {type !== 'time' && <div className="space-y-3 pt-2">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(8rem,max-content)] gap-3">
          <SheetSelect aria-label="Calendar month" value={page.month} onChange={event => setPage({ ...page, month: Number(event.target.value) })}>{Array.from({ length: 12 }, (_, month) => <option key={month} value={month}>{new Date(2000, month).toLocaleDateString('en-US', { month: 'long' })}</option>)}</SheetSelect>
          <SheetSelect className="ui-calendar-year" scrollToSelected aria-label="Calendar year" value={page.year} onChange={event => setPage({ ...page, year: Number(event.target.value) })}>{Array.from({ length: 171 }, (_, i) => yearNow - 120 + i).concat(page.year < yearNow - 120 || page.year > yearNow + 50 ? [page.year] : []).sort((a,b) => b-a).map(year => <option key={year} value={year}>{year}</option>)}</SheetSelect>
        </div>
        <div className="ui-date-grid">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day => <span key={day} className="py-2 text-center text-xs text-slate-400">{day.slice(0,1)}</span>)}
          {Array.from({ length: first }, (_, i) => <span key={`blank-${i}`} />)}
          {Array.from({ length: days }, (_, i) => { const next = `${page.year}-${pad(page.month+1)}-${pad(i+1)}`; return <button key={next} type="button" disabled={type === 'datetime-local' ? !!((minimum && next < minimum.slice(0,10)) || (maximum && next > maximum.slice(0,10))) : invalid(next)} aria-label={new Date(page.year,page.month,i+1).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} aria-pressed={date === next} className="ui-date-day" onClick={() => { setDate(next); if (type === 'date') commit(next); }}>{i+1}</button>; })}
        </div>
      </div>}
      {type !== 'date' && <div className="space-y-4 pt-4">
        <div className="grid grid-cols-3 gap-3">
          <label className="text-sm">Hour<SheetSelect aria-label="Hour" value={hours % 12 || 12} onChange={event => setHour(Number(event.target.value) % 12 + (hours >= 12 ? 12 : 0))}>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i+1}>{i+1}</option>)}</SheetSelect></label>
          <label className="text-sm">Minute<SheetSelect aria-label="Minute" value={minutes} onChange={event => setTime(`${pad(hours)}:${event.target.value}`)}>{Array.from({ length: 60 }, (_, i) => <option key={i} value={pad(i)}>{pad(i)}</option>)}</SheetSelect></label>
          <label className="text-sm">Period<SheetSelect aria-label="AM or PM" value={hours >= 12 ? 'pm' : 'am'} onChange={event => setHour(hours % 12 + (event.target.value === 'pm' ? 12 : 0))}><option value="am">AM</option><option value="pm">PM</option></SheetSelect></label>
        </div>
        <button type="button" className="ui-primary w-full" disabled={(type === 'datetime-local' && !date) || invalid(type === 'time' ? time : `${date}T${time}`)} onClick={() => commit(type === 'time' ? time : `${date}T${time}`)}>Set {type === 'time' ? 'time' : 'date and time'}</button>
      </div>}
      {!required && <button type="button" className="ui-secondary w-full mt-4" onClick={() => commit('')}>Clear {type === 'time' ? 'time' : 'date'}</button>}
    </BottomSheet>
  </span>;
}
