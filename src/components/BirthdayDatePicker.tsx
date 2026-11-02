import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { BottomSheet } from './BottomSheet';

const ROW = 48;
const COPIES = 7;
const MIDDLE = Math.floor(COPIES / 2);
const months = Array.from({ length: 12 }, (_, index) => new Date(2000, index, 1).toLocaleDateString('en-US', { month: 'long' }));
const wrap = (index: number, count: number) => ((index % count) + count) % count;
const daysInMonth = (month: number) => new Date(2000, month, 0).getDate();

/** Repeat rows around a central copy, then recenter invisibly after scrolling settles. */
function Wheel({ label, labels, value, selection, onChange }: { label: string; labels: string[]; value: number; selection: React.MutableRefObject<number>; onChange: (value: number) => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const count = labels.length;
  useLayoutEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    selection.current = value;
    if (scroller.current) scroller.current.scrollTop = (MIDDLE * count + value - 1) * ROW;
  }, [count, value]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const settle = () => {
    const element = scroller.current;
    if (!element) return;
    const index = Math.round(element.scrollTop / ROW);
    const next = wrap(index, count) + 1;
    element.scrollTop = (MIDDLE * count + next - 1) * ROW;
    onChange(next);
  };
  return <div className="birthday-wheel-column">
    <div className="mb-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</div>
    <div className="birthday-wheel-frame">
      <div aria-hidden="true" className="birthday-wheel-highlight" />
      <div ref={scroller} className="birthday-wheel" role="spinbutton" tabIndex={0} aria-label={`Birthday ${label.toLowerCase()}`} aria-valuemin={1} aria-valuemax={count} aria-valuenow={value} aria-valuetext={labels[value - 1]}
        onScroll={() => { if (scroller.current) selection.current = wrap(Math.round(scroller.current.scrollTop / ROW), count) + 1; if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(settle, 120); }}
        onKeyDown={event => {
          const delta = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
          if (!delta && event.key !== 'Home' && event.key !== 'End') return;
          event.preventDefault();
          onChange(event.key === 'Home' ? 1 : event.key === 'End' ? count : wrap(value - 1 + delta, count) + 1);
        }}>
        {Array.from({ length: count * COPIES }, (_, index) => <div key={index} aria-hidden="true" className="birthday-wheel-row" data-wheel-value={wrap(index, count) + 1}
          onClick={() => scroller.current?.scrollTo({ top: index * ROW, behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}>{labels[wrap(index, count)]}</div>)}
      </div>
    </div>
  </div>;
}

export function BirthdayDatePicker({ value, onChange, disabled = false, label = 'Birthday' }: { label?: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const monthSelection = useRef(1), daySelection = useRef(1);
  const [month, setMonth] = useState(1), [day, setDay] = useState(1);
  const selectedMonth = Number(value.slice(5, 7)) || 1;
  const selectedDay = Number(value.slice(8, 10)) || 1;
  const show = () => { setMonth(selectedMonth); setDay(Math.min(selectedDay, daysInMonth(selectedMonth))); setOpen(true); };
  return <>
    <button type="button" disabled={disabled} aria-label={`${label} (month and day)`} aria-haspopup="dialog" aria-expanded={open} className="ui-sheet-select" onClick={show}><span className="min-w-0 flex-1 truncate">{months[selectedMonth - 1]} {selectedDay}</span><ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" /></button>
    <BottomSheet open={open} title={label} onClose={() => setOpen(false)}>
      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3 py-3">
        <Wheel label="Month" selection={monthSelection} labels={months} value={month} onChange={next => { setMonth(next); setDay(previous => Math.min(previous, daysInMonth(next))); }} />
        <Wheel label="Day" selection={daySelection} labels={Array.from({ length: daysInMonth(month) }, (_, index) => String(index + 1))} value={day} onChange={setDay} />
      </div>
      <div className="flex gap-3 pt-3">
        <button type="button" className="ui-secondary flex-1" onClick={() => setOpen(false)}>Cancel</button>
        <button type="button" className="ui-primary flex-1" onClick={() => { const finalMonth = monthSelection.current; const finalDay = Math.min(daySelection.current, daysInMonth(finalMonth)); onChange(`2000-${String(finalMonth).padStart(2, '0')}-${String(finalDay).padStart(2, '0')}`); setOpen(false); }}>{label === 'Birthday' ? 'Set birthday' : 'Set date'}</button>
      </div>
    </BottomSheet>
  </>;
}
