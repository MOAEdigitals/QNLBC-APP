import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { orderSameDateSetlists, sameDateSetlistMove } from '../utils/initialSetlistCard';
import type { OrderedSetlistCard } from '../utils/initialSetlistCard';

export type SaveSetlistOrder = (date: string, orderedIds: string[], expectedRevisions: Record<string, number>) => Promise<void>;
type Target = { id: string; edge: 'before' | 'after' };
type PreviewRow = { id: string; bounds: DOMRect };
type SongPreview = { rows: PreviewRow[]; source: number; startScroll: number; stride: number };
type Gesture = { id: string; date: string; pointerId: number; startX: number; startY: number; x: number; y: number; moved: boolean; target: Target | null; readyAt: number; scroll: HTMLElement | null; preview?: SongPreview };

/** Drag only the handle: normal card taps, expanded content and page scrolling stay independent. */
export function useSetlistReorder(items: OrderedSetlistCard[], save?: SaveSetlistOrder, enabled = false, options: { attribute?: string; holdDelay?: number; label?: string; livePreview?: boolean } = {}) {
  const attribute = options.attribute || 'data-setlist-drag-id';
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [pressedId, setPressedId] = useState<string | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [rowOffsets, setRowOffsets] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const gesture = useRef<Gesture | null>(null);
  const frame = useRef<number | null>(null);
  const hold = useRef<number | null>(null);
  const saving = useRef(false);
  const alive = useRef(true);
  const current = useRef({ items, save, enabled });
  current.current = { items, save, enabled };

  const stopFrame = () => { if (frame.current !== null) cancelAnimationFrame(frame.current); frame.current = null; };
  const stopHold = () => { if (hold.current !== null) window.clearTimeout(hold.current); hold.current = null; };
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; stopFrame(); stopHold(); gesture.current = null; };
  }, []);

  const locateTarget = () => {
    const active = gesture.current;
    if (!active?.moved) return;
    if (active.preview) {
      const { rows, source, startScroll, stride } = active.preview;
      const scrollDelta = (active.scroll?.scrollTop ?? window.scrollY) - startScroll;
      const lift = active.y - active.startY + scrollDelta;
      const first = rows[0].bounds;
      const last = rows[rows.length - 1].bounds;
      const anchor = rows[source].bounds;
      const center = anchor.top + anchor.height / 2 + lift;
      let destination = source;
      if (active.x >= first.left && active.x <= first.right
        && active.y + scrollDelta >= first.top && active.y + scrollDelta <= last.bottom) {
        while (destination < rows.length - 1) {
          const bounds = rows[destination + 1].bounds;
          if (center < bounds.top + bounds.height / 2) break;
          destination++;
        }
        while (destination > 0) {
          const bounds = rows[destination - 1].bounds;
          if (center > bounds.top + bounds.height / 2) break;
          destination--;
        }
      }
      active.target = destination === source ? null : {
        id: rows[destination].id, edge: destination < source ? 'before' : 'after',
      };
      const offsets: Record<string, number> = { [active.id]: lift };
      for (let index = Math.min(source, destination); index <= Math.max(source, destination); index++) {
        if (index !== source) offsets[rows[index].id] = destination < source ? stride : -stride;
      }
      setRowOffsets(offsets);
      return;
    }
    const card = document.elementFromPoint(active.x, active.y)?.closest<HTMLElement>(`[${attribute}]`);
    const id = card?.getAttribute(attribute);
    const item = current.current.items.find(item => item.id === id);
    let next: Target | null = null;
    if (card && item && id !== active.id && item.date === active.date) {
      const bounds = (card.querySelector('[data-setlist-card-header]') || card).getBoundingClientRect();
      next = { id: item.id, edge: active.y < bounds.top + bounds.height / 2 ? 'before' : 'after' };
    }
    active.target = next;
    setTarget(previous => previous?.id === next?.id && previous?.edge === next?.edge ? previous : next);
  };

  const autoScroll = () => {
    frame.current = null;
    const active = gesture.current;
    if (!active?.moved) return;
    const viewport = window.visualViewport;
    const bounds = active.scroll?.getBoundingClientRect();
    const top = bounds?.top ?? (viewport?.offsetTop || 0), bottom = bounds?.bottom ?? (top + (viewport?.height || window.innerHeight));
    const velocity = active.y < top + 90 ? -Math.min(14, (top + 90 - active.y) / 5)
      : active.y > bottom - 100 ? Math.min(14, (active.y - bottom + 100) / 5) : 0;
    if (velocity) {
      const previousScroll = active.scroll?.scrollTop ?? window.scrollY;
      if (active.scroll) active.scroll.scrollTop += velocity;
      else window.scrollBy(0, velocity);
      if ((active.scroll?.scrollTop ?? window.scrollY) !== previousScroll) locateTarget();
    }
    frame.current = requestAnimationFrame(autoScroll);
  };

  const reset = () => { stopFrame(); stopHold(); gesture.current = null; setPressedId(null); setDrag(null); setTarget(null); setRowOffsets({}); };
  const persist = async (source: string, destination: Target) => {
    const state = current.current;
    if (saving.current || !state.enabled || !state.save) return;
    saving.current = true; setBusy(true); setError('');
    try {
      const move = sameDateSetlistMove(state.items, source, destination.id, destination.edge);
      const previous = orderSameDateSetlists(state.items.filter(item => item.date === move.date)).map(item => item.id);
      if (previous.every((id, index) => id === move.orderedIds[index])) return;
      await state.save(move.date, move.orderedIds, move.expectedRevisions);
      if (alive.current) setAnnouncement(options.label ? `${options.label} order updated.` : `Setlist order saved for ${move.date}.`);
    } catch (reason) {
      if (alive.current) setError(reason instanceof Error ? reason.message : 'Order could not be saved. Please try again.');
    } finally {
      saving.current = false;
      if (alive.current) setBusy(false);
    }
  };

  const canDrag = (item: OrderedSetlistCard) => enabled && !!save && items.filter(other => other.date === item.date).length > 1;
  const handleProps = (item: OrderedSetlistCard): React.ButtonHTMLAttributes<HTMLButtonElement> => ({
    type: 'button', disabled: busy,
    'aria-label': `Reorder ${item.id}. Drag within the same date, or use Arrow Up and Arrow Down.`,
    title: 'Drag to reorder cards with the same date',
    onClick: event => { event.preventDefault(); event.stopPropagation(); },
    onPointerDown: event => {
      event.preventDefault(); event.stopPropagation();
      if (event.button !== 0 || gesture.current || saving.current || !canDrag(item)) return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setError(''); setAnnouncement(''); setPressedId(item.id);
      const scroll = event.currentTarget.closest<HTMLElement>('.ui-modal-form');
      const active: Gesture = { id: item.id, date: item.date, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, moved: false, target: null, readyAt: Date.now() + (options.holdDelay || 0), scroll };
      if (options.livePreview) {
        const ids = new Set(current.current.items.filter(row => row.date === item.date).map(row => row.id));
        const rows: PreviewRow[] = [];
        for (const row of (scroll ?? document).querySelectorAll<HTMLElement>(`[${attribute}]`)) {
          const id = row.getAttribute(attribute);
          if (id && ids.has(id)) rows.push({ id, bounds: row.getBoundingClientRect() });
        }
        const source = rows.findIndex(row => row.id === item.id);
        if (source >= 0 && rows.length > 1) {
          const bounds = rows[source].bounds;
          const gap = source > 0 ? bounds.top - rows[source - 1].bounds.bottom : rows[1].bounds.top - bounds.bottom;
          active.preview = { rows, source, startScroll: scroll?.scrollTop ?? window.scrollY, stride: bounds.height + gap };
        }
      }
      gesture.current = active;
      if (options.holdDelay) {
        hold.current = window.setTimeout(() => {
          hold.current = null;
          if (gesture.current !== active) return;
          active.moved = true;
          setDrag({ id: active.id, x: active.x, y: active.y });
          locateTarget();
          if (frame.current === null) frame.current = requestAnimationFrame(autoScroll);
        }, options.holdDelay);
      }
    },
    onPointerMove: event => {
      const active = gesture.current;
      if (!active || event.pointerId !== active.pointerId) return;
      active.x = event.clientX; active.y = event.clientY;
      if (!active.moved && Math.hypot(active.x - active.startX, active.y - active.startY) < 6) return;
      if (Date.now() < active.readyAt) { reset(); return; }
      active.moved = true;
      setDrag({ id: active.id, x: active.x, y: active.y });
      locateTarget();
      if (frame.current === null) frame.current = requestAnimationFrame(autoScroll);
    },
    onPointerUp: event => {
      const active = gesture.current;
      if (!active || event.pointerId !== active.pointerId) return;
      const destination = active.target;
      reset();
      if (active.moved && destination) void persist(active.id, destination);
    },
    onPointerCancel: reset,
    onLostPointerCapture: () => { if (gesture.current) reset(); },
    onKeyDown: event => {
      if (event.key === 'Escape') { event.stopPropagation(); reset(); return; }
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      event.preventDefault(); event.stopPropagation();
      const group = orderSameDateSetlists(current.current.items.filter(other => other.date === item.date));
      const index = group.findIndex(other => other.id === item.id);
      const direction = event.key === 'ArrowUp' ? -1 : 1;
      const destination = group[index + direction];
      if (destination) void persist(item.id, { id: destination.id, edge: direction < 0 ? 'before' : 'after' });
    },
  });
  return { drag, pressedId, target, rowOffsets, busy, error, announcement, canDrag, handleProps };
}
