import { UpcomingBadge } from './UpcomingBadge';
import { SetlistShareDialog } from './SetlistShareDialog';
import { CardDate } from './CardDate';
import { initialSetlistCardId, orderSameDateSetlists } from '../utils/initialSetlistCard';
import { useSetlistReorder } from '../hooks/useSetlistReorder';
import type { SaveSetlistOrder } from '../hooks/useSetlistReorder';
import { createPortal } from 'react-dom';
import { monthList } from './MonthSeparators';
import { SetlistEditorSection } from './SetlistEditorSection';
import { useBackLayer } from '../hooks/useBackLayer';
import { useHeaderSearch } from './HeaderSearch';
import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { Setlist, Song, SetlistSongItem, SetlistType } from '../types';
import {
  formatDateStr,
  parseDate,
  isPastDate,
  isToday,
  getNextSundayStr,
  getTodayStr,
  sortUpcomingFirst,
} from '../utils/dateUtils';
import {
  loadWelcomeSongs,
  saveWelcomeSongs,
  getAllDirectoryNames,
} from '../utils/storage';
import { generateUUID, isUUID } from '../services/supabaseData';
import { COLOR_PALETTE, getPersonColor } from '../utils/personColors';
import { AutofillInput, SongPickerFilter } from './AutofillInput';
import {
  Calendar,
  Clock,
  User,
  Plus,
  Trash2,
  Edit3,
  X,
  Sparkles,
  ChevronDown,
  Users,
  Flame,
  AlertCircle,
  CheckCircle,
  MoreHorizontal,
  Copy,
  Check,
  Search,
  GripVertical,
  Share2,
} from 'lucide-react';

export function formatSetlistForMessenger(setlist: Setlist, songs: Song[] = []): string {
  const sections: string[] = [];

  const resolveTitle = (rawTitle?: string, songId?: string): string => {
    if (!rawTitle?.trim()) return '';
    if (songId) {
      const match = songs.find((s) => s.id === songId);
      if (match) return match.title;
    }
    const match = songs.find((s) => s.title.trim().toLowerCase() === rawTitle.trim().toLowerCase());
    return match ? match.title : rawTitle.trim();
  };

  // 1. Date Header: e.g. "Sunday, Aug 30, 2026"
  const dateObj = new Date(setlist.date + 'T00:00:00');
  const dayName = isNaN(dateObj.getTime())
    ? ''
    : dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  const dateFormatted = isNaN(dateObj.getTime())
    ? setlist.date
    : dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

  const headerDateLine = dayName ? `${dayName}, ${dateFormatted}` : dateFormatted;
  sections.push(headerDateLine);

  // 2. Presider, Welcome Song, Closing Song Block
  const topMeta: string[] = [];
  if (setlist.presider?.trim()) {
    topMeta.push(`Presider: ${setlist.presider.trim()}`);
  }
  if (setlist.welcomeSong?.trim()) {
    topMeta.push(`Welcome Song: ${resolveTitle(setlist.welcomeSong)}`);
  }
  if (setlist.closingSong?.trim()) {
    topMeta.push(`Closing Song: ${resolveTitle(setlist.closingSong)}`);
  }
  if (topMeta.length > 0) {
    sections.push(topMeta.join('\n'));
  }

  // 3. Program Sections
  if (setlist.type === 'sunday' || !setlist.type) {
    // Sunday School Section
    const ssLeader = setlist.sundaySchool?.songLeader?.trim();
    const ssSongs = (setlist.sundaySchool?.songs || []).filter((s) => s.title.trim());
    const ssLines: string[] = [];
    ssLines.push(`Sunday School: ${ssLeader || ''}`.trimEnd());
    ssSongs.forEach((song, idx) => {
      const displayTitle = resolveTitle(song.title, song.songId);
      ssLines.push(`${idx + 1}. ${displayTitle}${song.keyNote ? ` (${song.keyNote})` : ''}`);
    });

    sections.push(ssLines.join('\n'));

    // Worship Service Section
    const wsLeader = setlist.worshipService?.songLeader?.trim();
    const wsSongs = (setlist.worshipService?.songs || []).filter((s) => s.title.trim());
    const wsLines: string[] = [];
    wsLines.push(`Worship Service: ${wsLeader || ''}`.trimEnd());
    wsSongs.forEach((song, idx) => {
      const displayTitle = resolveTitle(song.title, song.songId);
      wsLines.push(`${idx + 1}. ${displayTitle}${song.keyNote ? ` (${song.keyNote})` : ''}`);
    });
    if (setlist.themeSong?.trim()) {
      const themeNum = wsSongs.length + 1;
      const displayTheme = resolveTitle(setlist.themeSong);
      wsLines.push(`${themeNum}. ${displayTheme} (Theme Song)`);
    }

    sections.push(wsLines.join('\n'));
  } else {
    // Non-Sunday Programs (Prayer Meeting, Fellowship, Event)
    const progTitle =
      setlist.title?.trim() ||
      (setlist.type === 'prayer_meeting'
        ? 'Midweek Prayer Meeting'
        : setlist.type === 'fellowship'
        ? 'Youth Fellowship'
        : setlist.type === 'event'
        ? 'Special Church Event'
        : 'Program');

    const progLeader = setlist.program?.songLeader?.trim();
    const progSongs = (setlist.program?.songs || []).filter((s) => s.title.trim());
    const progLines: string[] = [];
    progLines.push(`${progTitle}: ${progLeader || ''}`.trimEnd());
    progSongs.forEach((song, idx) => {
      const displayTitle = resolveTitle(song.title, song.songId);
      progLines.push(`${idx + 1}. ${displayTitle}${song.keyNote ? ` (${song.keyNote})` : ''}`);
    });
    if (setlist.themeSong?.trim()) {
      const themeNum = progSongs.length + 1;
      const displayTheme = resolveTitle(setlist.themeSong);
      progLines.push(`${themeNum}. ${displayTheme} (Theme Song)`);
    }

    sections.push(progLines.join('\n'));
  }

  return sections.join('\n\n');
}

function SetlistPerson({ role, name }: { role: string; name?: string }) {
  const color = getPersonColor(name);
  return <div className="flex min-w-0 items-center gap-2.5">
    <span className="flex h-8 w-8 shrink-0 items-center justify-center text-slate-500 dark:text-slate-400"><User className="h-4 w-4" aria-hidden="true" /></span>
    <div className="min-w-0">
      <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">{role}</span>
      <span className={`block break-words text-sm font-bold ${color.textBold}`}>{name || 'Unassigned'}</span>
    </div>
  </div>;
}

interface SetlistsTabProps {
  setlists: Setlist[];
  songs: Song[];
  savedNames?: string[];
  onSaveSetlist: (setlist: Setlist) => Promise<boolean>;
  onReorderSetlists?: SaveSetlistOrder;
  canReorder?: boolean;
  onDeleteSetlist: (id: string) => void;
  onOpenSongDetail: (songId: string, returnSetlistId?: string) => void;
  onSubViewChange?: (hasActiveSubView: boolean) => void;
  initialSelectedSetlistId?: string | null;
  initialExpandedSetlistIds?: string[];
  onExpandedSetlistsChange?: (ids: string[]) => void;
  initialScrollY?: number | null;
  collapseSignal?: number;
}

export const SetlistsTab: React.FC<SetlistsTabProps> = ({
  setlists,
  songs,
  savedNames,
  onSaveSetlist,
  onReorderSetlists,
  canReorder = false,
  onDeleteSetlist,
  onOpenSongDetail,
  onSubViewChange,
  initialSelectedSetlistId,
  initialExpandedSetlistIds,
  onExpandedSetlistsChange,
  initialScrollY,
  collapseSignal,
}) => {
  const [selectedSetlistId, setSelectedSetlistId] = useState<string | null>(
    () => initialSetlistCardId(setlists, getTodayStr(), initialSelectedSetlistId, initialExpandedSetlistIds)
  );
  const [expandedSetlistIds, setExpandedSetlistIds] = useState<string[]>(() => {
    return selectedSetlistId ? [selectedSetlistId] : [];
  });
  useEffect(() => { onExpandedSetlistsChange?.(expandedSetlistIds); }, [expandedSetlistIds, onExpandedSetlistsChange]);

  const handleOpenSong = (songId: string, setlistId: string) => {
    const currentY = window.scrollY || document.documentElement.scrollTop || 0;
    try {
      sessionStorage.setItem('nlbc_saved_setlist_scroll_y', String(currentY));
      sessionStorage.setItem('nlbc_saved_setlist_id', setlistId);
    } catch {}
    onOpenSongDetail(songId, setlistId);
  };

  const restoredScrollRef = useRef(false);

  // Restore scroll position instantly when returning to setlist
  useLayoutEffect(() => {
    let targetY = initialScrollY;
    if (targetY == null) {
      try {
        const stored = sessionStorage.getItem('nlbc_saved_setlist_scroll_y');
        if (stored != null) {
          targetY = parseFloat(stored);
        }
      } catch {}
    }

    if (targetY != null && !Number.isNaN(targetY)) {
      restoredScrollRef.current = true;
      const applyScroll = () => {
        try {
          window.scrollTo({ top: targetY!, behavior: 'instant' as ScrollBehavior });
        } catch {
          window.scrollTo(0, targetY!);
        }
        const scroller = document.scrollingElement || document.documentElement || document.body;
        if (scroller && scroller.scrollTop !== targetY) {
          scroller.scrollTop = targetY!;
        }
      };

      applyScroll();
      requestAnimationFrame(() => {
        applyScroll();
      });
      try {
        sessionStorage.removeItem('nlbc_saved_setlist_scroll_y');
      } catch {}
    }
  }, [initialScrollY]);

  const [isEditing, setIsEditing] = useState(false);
  const [editingSetlist, setEditingSetlist] = useState<Partial<Setlist> | null>(null);
  const songSlots = useMemo(() => (['sundaySchool', 'worshipService', 'program'] as const).flatMap(section =>
    (editingSetlist?.[section]?.songs || []).map((song, index) => ({
      id: `${section}:${song.id || index}`, date: section, displayOrder: index, song,
    }))), [editingSetlist]);
  const songReorder = useSetlistReorder(songSlots, async (section, ids) => {
    const songs = ids.map(id => songSlots.find(slot => slot.id === id)!.song);
    setEditingSetlist(previous => {
      if (!previous) return previous;
      const key = section as 'sundaySchool' | 'worshipService' | 'program';
      const program = previous[key];
      return program ? { ...previous, [key]: { ...program, songs } } : previous;
    });
  }, isEditing, { attribute: 'data-song-slot-id', holdDelay: 250, label: 'Songs' });
  const songRowProps = (id: string) => ({
    'data-song-slot-id': id,
    className: `relative flex items-center gap-2 rounded-lg ${songReorder.drag?.id === id ? 'opacity-50' : ''} ${songReorder.target?.id === id ? songReorder.target.edge === 'before' ? 'border-t-2 border-blue-500' : 'border-b-2 border-blue-500' : ''}`,
  });
  const songDragHandle = (section: string, index: number) => {
    const slot = songSlots.filter(slot => slot.date === section)[index];
    if (!slot || !songReorder.canDrag(slot)) return null;
    return <button {...songReorder.handleProps(slot)} aria-label={`Reorder song ${index + 1}. Hold and drag, or use arrow keys.`} title="Hold and drag to reorder songs" className="flex h-11 w-7 shrink-0 touch-none select-none items-center justify-center rounded-lg text-slate-400 cursor-grab active:cursor-grabbing"><GripVertical className="h-4 w-4" aria-hidden="true" /></button>;
  };
  const selectedSetlistSongTitles = useMemo(() => {
    if (!editingSetlist) return [];
    const sunday = !editingSetlist.type || editingSetlist.type === 'sunday';
    return [
      ...(editingSetlist.type !== 'prayer_meeting' ? [editingSetlist.welcomeSong ?? 'Napakaligaya', editingSetlist.closingSong ?? 'Give Thanks'] : []),
      editingSetlist.themeSong || '',
      ...(sunday
        ? [...(editingSetlist.sundaySchool?.songs || []), ...(editingSetlist.worshipService?.songs || [])]
        : editingSetlist.program?.songs || []).map(song => song.title),
    ].filter(title => title.trim());
  }, [editingSetlist]);
  const [showCustomTitle, setShowCustomTitle] = useState(false);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [openMenuSetlistId, setOpenMenuSetlistId] = useState<string | null>(null);
  const [sharePreview, setSharePreview] = useState<{ id: string; badge?: string } | null>(null);
  const [copiedSetlistId, setCopiedSetlistId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  useHeaderSearch({ value: searchQuery, onChange: setSearchQuery, placeholder: 'Search names, songs, dates, or setlists', label: 'Search setlists' });
  const [isSaving, setIsSaving] = useState(false);
  const [songPickerFilter, setSongPickerFilter] = useState<SongPickerFilter>('all');
  const saveInProgressRef = useRef(false);

  useEffect(() => {
    if (!isEditing) setSongPickerFilter('all');
  }, [isEditing]);

  // Scroll anchor reference for keeping tapped setlist card pinned in place on screen
  const scrollAnchorRef = useRef<{
    setlistId: string;
    initialScreenY: number;
  } | null>(null);

  // Precise Scroll Anchoring:
  // When a setlist is tapped while another setlist above it collapses, the document height shrinks.
  // We capture the tapped setlist card's screen position before the state change and in useLayoutEffect
  // after the DOM updates, we adjust the scroll position by the exact difference (delta) so the tapped
  // setlist card stays locked in the exact same screen position without jumping up or down.
  useLayoutEffect(() => {
    const anchor = scrollAnchorRef.current;
    if (!anchor) return;
    if (selectedSetlistId !== anchor.setlistId) {
      scrollAnchorRef.current = null;
      return;
    }

    const cardEl = document.getElementById(`setlist-card-${anchor.setlistId}`);
    if (!cardEl) {
      scrollAnchorRef.current = null;
      return;
    }

    // Measure new position of the card header/top after collapse of previous and expansion of current
    const currentScreenY = cardEl.getBoundingClientRect().top;
    const delta = currentScreenY - anchor.initialScreenY;

    const applyScrollCorrection = (offset: number) => {
      let scrollContainer: HTMLElement | null = null;
      let parent = cardEl.parentElement;
      while (parent && parent !== document.body && parent !== document.documentElement) {
        const style = window.getComputedStyle(parent);
        if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight) {
          scrollContainer = parent;
          break;
        }
        parent = parent.parentElement;
      }

      if (scrollContainer) {
        scrollContainer.scrollTop += offset;
      } else {
        const scroller = document.scrollingElement || document.documentElement || document.body;
        const currentTop = window.scrollY || scroller.scrollTop || 0;
        const newTop = Math.max(0, currentTop + offset);
        try {
          window.scrollTo({ top: newTop, behavior: 'instant' as ScrollBehavior });
        } catch {
          window.scrollTo(0, newTop);
        }
        if (scroller && scroller.scrollTop !== newTop) {
          scroller.scrollTop = newTop;
        }
      }
    };

    if (Math.abs(delta) > 0.5) {
      applyScrollCorrection(delta);
    }

    // Secondary verification on requestAnimationFrame to compensate for any micro-shifts
    const rafId = requestAnimationFrame(() => {
      const el = document.getElementById(`setlist-card-${anchor.setlistId}`);
      if (el) {
        const rafScreenY = el.getBoundingClientRect().top;
        const rafDelta = rafScreenY - anchor.initialScreenY;
        if (Math.abs(rafDelta) > 1) {
          applyScrollCorrection(rafDelta);
        }
      }
      scrollAnchorRef.current = null;
    });

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [selectedSetlistId]);

  // Sync initialSelectedSetlistId prop if provided and preserve expanded container
  useEffect(() => {
    if (initialSelectedSetlistId) {
      setSelectedSetlistId(initialSelectedSetlistId);
      setExpandedSetlistIds([initialSelectedSetlistId]);

      // If scroll position was already restored to the exact position, do not override with scrollIntoView
      if (restoredScrollRef.current || initialScrollY != null) {
        return;
      }

      const timer = setTimeout(() => {
        const el = document.getElementById(`setlist-card-${initialSelectedSetlistId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [initialSelectedSetlistId, initialScrollY]);

  const lastProcessedSignalRef = useRef<number>(0);

  // Smart Progressive Tab Action: Return to Open -> Collapse -> Scroll to Top
  useEffect(() => {
    if (collapseSignal !== undefined && collapseSignal > 0 && collapseSignal !== lastProcessedSignalRef.current) {
      lastProcessedSignalRef.current = collapseSignal;

      if (isEditing && !saveInProgressRef.current) {
        setIsEditing(false);
        setEditingSetlist(null);
        setEditPromptMsg(null);
        setShowTypeSelector(false);
        return;
      }

      if (selectedSetlistId) {
        // Reselecting the navigation tab does not collapse a program.
        setShowTypeSelector(false);
        return;
      }

      // The next reselect scrolls smoothly to the top.
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [collapseSignal, selectedSetlistId, isEditing]);

  const handleCopySetlist = async (setlist: Setlist, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const text = formatSetlistForMessenger(setlist, songs);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedSetlistId(setlist.id);
      setTimeout(() => {
        setCopiedSetlistId((prev) => (prev === setlist.id ? null : prev));
      }, 2500);
    } catch (err) {
      console.error('Failed to copy setlist:', err);
    }
  };

  // Back swipe & dirty state tracking
  const initialEditingJsonRef = useRef<string>('');
  const backSwipeCountRef = useRef(0);
  const backSwipeTimeoutRef = useRef<any>(null);
  const [editPromptMsg, setEditPromptMsg] = useState<{ type: 'info' | 'warn'; message: string } | null>(null);

  // Memoized directory names for autocomplete (reacts immediately to real-time cloud changes)
  const directoryNames = useMemo(() => getAllDirectoryNames(savedNames), [savedNames, isEditing]);
  const songTitleSuggestions = useMemo(() => songs.map((s) => s.title), [songs]);

  // Sort upcoming soonest first, then past below
  const sortedSetlists = useMemo(
    () => orderSameDateSetlists(sortUpcomingFirst<Setlist>(setlists, (s: Setlist) => s.date)),
    [setlists]
  );
  const reorder = useSetlistReorder(sortedSetlists, onReorderSetlists, canReorder);
  const searchableSetlists = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return sortedSetlists;
    return sortedSetlists.filter((setlist) => [
      setlist.date, setlist.title, setlist.presider,
      setlist.sundaySchool?.songLeader, setlist.worshipService?.songLeader,
      setlist.program?.songLeader, setlist.welcomeSong, setlist.closingSong,
      setlist.themeSong,
      ...((setlist.sundaySchool?.songs || []).map((song) => song.title)),
      ...((setlist.worshipService?.songs || []).map((song) => song.title)),
      ...((setlist.program?.songs || []).map((song) => song.title)),
    ].some((value) => value?.toLocaleLowerCase().includes(query)));
  }, [sortedSetlists, searchQuery]);

  const searchSummaries = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return [];
    const names = new Map<string, { label: string; sundays: Set<string>; presided: number; led: number; upcoming: number }>();
    const titles = new Map<string, { label: string; sundays: Set<string>; upcoming: number }>();
    for (const setlist of setlists) {
      if (setlist.type && setlist.type !== 'sunday') continue;
      const people = [
        { value: setlist.presider, role: 'presider' },
        { value: setlist.sundaySchool?.songLeader, role: 'leader' },
        { value: setlist.worshipService?.songLeader, role: 'leader' },
      ];
      for (const { value, role } of people) {
        const label = value?.trim();
        if (!label || !label.toLocaleLowerCase().includes(query)) continue;
        const key = label.toLocaleLowerCase();
        const entry = names.get(key) || { label, sundays: new Set<string>(), presided: 0, led: 0, upcoming: 0 };
        if (!entry.sundays.has(setlist.id)) {
          entry.sundays.add(setlist.id);
          if (!isPastDate(setlist.date)) entry.upcoming++;
        }
        if (role === 'presider') entry.presided++;
        else entry.led++;
        names.set(key, entry);
      }
      const songTitles = [setlist.welcomeSong, setlist.closingSong, setlist.themeSong,
        ...(setlist.sundaySchool?.songs || []).map((song) => song.title),
        ...(setlist.worshipService?.songs || []).map((song) => song.title)];
      for (const value of songTitles) {
        const label = value?.trim();
        if (!label || !label.toLocaleLowerCase().includes(query)) continue;
        const key = label.toLocaleLowerCase();
        const entry = titles.get(key) || { label, sundays: new Set<string>(), upcoming: 0 };
        if (!entry.sundays.has(setlist.id)) {
          entry.sundays.add(setlist.id);
          if (!isPastDate(setlist.date)) entry.upcoming++;
        }
        titles.set(key, entry);
      }
    }
    return [
      ...[...names.values()].map((entry) => ({ label: entry.label, detail: `${entry.sundays.size} Sunday${entry.sundays.size === 1 ? '' : 's'} • ${entry.presided} presided • ${entry.led} song leader assignment${entry.led === 1 ? '' : 's'} • ${entry.upcoming} upcoming`, kind: 'Person' })),
      ...[...titles.values()].map((entry) => ({ label: entry.label, detail: `${entry.sundays.size} Sunday${entry.sundays.size === 1 ? '' : 's'} • ${entry.upcoming} upcoming`, kind: 'Song' })),
    ];
  }, [setlists, searchQuery]);
  const soonestUpcoming = useMemo(
    () => sortedSetlists.find((s) => !isPastDate(s.date) && !isToday(s.date)),
    [sortedSetlists]
  );
  const followingUpcoming = sortedSetlists.find(s => !isPastDate(s.date) && !isToday(s.date) && s.id !== soonestUpcoming?.id);
  const selectedSetlist = useMemo(
    () => setlists.find((s) => s.id === selectedSetlistId),
    [setlists, selectedSetlistId]
  );

  // Capture pointer events so an expanded card's stopPropagation cannot trap its action menu open.
  useEffect(() => {
    const handleDocumentPointerDown = (event: PointerEvent) => {
      if (!openMenuSetlistId) return;
      const target = event.target as Element | null;
      const actionArea = target?.closest('[data-setlist-actions]');
      if (actionArea?.getAttribute('data-setlist-actions') !== openMenuSetlistId) {
        setOpenMenuSetlistId(null);
      }
    };

    const handleDocumentClick = () => setShowTypeSelector(false);

    if (openMenuSetlistId) {
      document.addEventListener('pointerdown', handleDocumentPointerDown, true);
    }
    if (showTypeSelector) {
      document.addEventListener('click', handleDocumentClick);
    }
    return () => {
      document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [openMenuSetlistId, showTypeSelector]);

  // Notify parent App whether there is an active subview (expanded setlist or editor modal)
  useEffect(() => {
    const hasActive = isEditing;
    if (onSubViewChange) {
      onSubViewChange(hasActive);
    }
  }, [selectedSetlistId, isEditing, onSubViewChange]);

  useBackLayer(isEditing, () => {
    if (saveInProgressRef.current) return;
    if (!editingSetlist) return;
    const isDirty = JSON.stringify(editingSetlist) !== initialEditingJsonRef.current;
    if (!isDirty || backSwipeCountRef.current >= 1) {
      setIsEditing(false);
      setEditingSetlist(null);
      setEditPromptMsg(null);
      backSwipeCountRef.current = 0;
      return;
    }
    backSwipeCountRef.current = 1;
    const isEventOrFellowship = editingSetlist.type === 'event' || editingSetlist.type === 'fellowship';
    const hasMissingFields = !editingSetlist.date || (isEventOrFellowship && !editingSetlist.title?.trim());
    setEditPromptMsg({
      type: hasMissingFields ? 'warn' : 'info',
      message: hasMissingFields
        ? 'Incomplete required fields. Please fill all fields, or swipe back again to exit.'
        : 'All fields completed. Please click Save, or swipe back again to exit.',
    });
    if (backSwipeTimeoutRef.current) clearTimeout(backSwipeTimeoutRef.current);
    backSwipeTimeoutRef.current = setTimeout(() => {
      backSwipeCountRef.current = 0;
      setEditPromptMsg(null);
    }, 3500);
  });

  // Start creating Sunday Setlist
  const handleStartCreateSunday = () => {
    const nextSun = getNextSundayStr();

    const initialData: Partial<Setlist> = {
      id: generateUUID(),
      type: 'sunday',
      date: nextSun,
      presider: '',
      welcomeSong: 'Napakaligaya',
      closingSong: 'Give Thanks',
      themeSong: '',
      sundaySchool: {
        songLeader: '',
        songs: [
          { id: generateUUID(), title: '' },
          { id: generateUUID(), title: '' },
        ],
        notes: '',
      },
      worshipService: {
        songLeader: '',
        songs: [
          { id: generateUUID(), title: '' },
          { id: generateUUID(), title: '' },
        ],
        notes: '',
      },
      generalNotes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    initialEditingJsonRef.current = JSON.stringify(initialData);
    setEditingSetlist(initialData);
    setShowCustomTitle(false);
    setIsEditing(true);
    setEditPromptMsg(null);
    backSwipeCountRef.current = 0;
    setShowTypeSelector(false);
    window.history.pushState({ tab: 'home', subView: 'editing' }, '', '#home');
  };

  // Start creating non-Sunday setlist (Prayer Meeting, Fellowship, Event)
  const handleStartCreateOther = (type: SetlistType) => {
    const nextSun = getNextSundayStr();
    let initialData: Partial<Setlist>;

    if (type === 'prayer_meeting') {
      initialData = {
        id: generateUUID(),
        type: 'prayer_meeting',
        title: 'Midweek Prayer Meeting',
        date: nextSun,
        program: {
          songLeader: '',
          songs: [
            { id: generateUUID(), title: '' },
            { id: generateUUID(), title: '' },
          ],
          notes: '',
        },
        generalNotes: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } else if (type === 'fellowship') {
      initialData = {
        id: generateUUID(),
        type: 'fellowship',
        title: 'Youth Fellowship',
        date: nextSun,
        presider: '',
        welcomeSong: 'Napakaligaya',
        closingSong: 'Give Thanks',
        program: {
          songLeader: '',
          songs: [
            { id: generateUUID(), title: '' },
            { id: generateUUID(), title: '' },
          ],
          notes: '',
        },
        generalNotes: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } else {
      initialData = {
        id: generateUUID(),
        type: 'event',
        title: '',
        date: nextSun,
        presider: '',
        welcomeSong: 'Napakaligaya',
        closingSong: 'Give Thanks',
        program: {
          songLeader: '',
          songs: [
            { id: generateUUID(), title: '' },
            { id: generateUUID(), title: '' },
            { id: generateUUID(), title: '' },
          ],
          notes: '',
        },
        generalNotes: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    initialEditingJsonRef.current = JSON.stringify(initialData);
    setEditingSetlist(initialData);
    setIsEditing(true);
    setEditPromptMsg(null);
    backSwipeCountRef.current = 0;
    setShowTypeSelector(false);
    window.history.pushState({ tab: 'home', subView: 'editing' }, '', '#home');
  };

  const handleStartEdit = (setlist: Setlist) => {
    const cloned = JSON.parse(JSON.stringify(setlist));
    initialEditingJsonRef.current = JSON.stringify(cloned);
    setEditingSetlist(cloned);
    setShowCustomTitle(!!cloned.title);
    setIsEditing(true);
    setEditPromptMsg(null);
    backSwipeCountRef.current = 0;
    window.history.pushState({ tab: 'home', subView: 'editing' }, '', '#home');
  };

  const handleUpdateSongSlot = (
    section: 'sundaySchool' | 'worshipService' | 'program',
    idx: number,
    newTitle: string
  ) => {
    if (!editingSetlist) return;
    const currentSection = editingSetlist[section];
    if (!currentSection) return;

    const matched = songs.find(
      (item) => item.title.trim().toLowerCase() === newTitle.trim().toLowerCase()
    );

    const updated = (currentSection.songs || []).map((songItem, i) => {
      if (i !== idx) return songItem;
      return {
        ...songItem,
        title: newTitle,
        songId: matched ? matched.id : undefined,
        song_id: matched ? matched.id : undefined,
      };
    });

    setEditingSetlist({
      ...editingSetlist,
      [section]: {
        ...currentSection,
        songs: updated,
      },
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSetlist || !editingSetlist.date || saveInProgressRef.current) return;

    const setlistType: SetlistType = editingSetlist.type || 'sunday';

    const cleanSongs = (songsList: SetlistSongItem[] | undefined): SetlistSongItem[] => {
      if (!songsList) return [];
      return songsList
        .filter((s) => s && s.title && s.title.trim().length > 0)
        .map((s) => {
          const trimmedTitle = s.title.trim();
          const linkedId = s.songId || s.song_id;
          const matchedSong = linkedId
            ? songs.find(item => item.id === linkedId)
            : songs.find(item => item.title.trim().toLowerCase() === trimmedTitle.toLowerCase());
          return {
            id: s.id && isUUID(s.id) ? s.id : generateUUID(),
            title: matchedSong ? matchedSong.title : trimmedTitle,
            songId: matchedSong && isUUID(matchedSong.id) ? matchedSong.id : undefined,
            keyNote: s.keyNote,
            notes: s.notes,
          };
        });
    };

    const finalSetlist: Setlist = {
      id: editingSetlist.id && isUUID(editingSetlist.id) ? editingSetlist.id : generateUUID(),
      revision: editingSetlist.revision,
      type: setlistType,
      title: editingSetlist.title?.trim() || undefined,
      date: editingSetlist.date,
      presider: editingSetlist.presider?.trim() || undefined,
      welcomeSong:
        editingSetlist.welcomeSong !== undefined
          ? (editingSetlist.welcomeSong.trim() || undefined)
          : (setlistType === 'sunday' ? 'Napakaligaya' : undefined),
      closingSong:
        editingSetlist.closingSong !== undefined
          ? (editingSetlist.closingSong.trim() || undefined)
          : (setlistType === 'sunday' ? 'Give Thanks' : undefined),
      themeSong: editingSetlist.themeSong?.trim() || undefined,
      sundaySchool:
        setlistType === 'sunday'
          ? {
              songLeader: editingSetlist.sundaySchool?.songLeader?.trim() || '',
              songs: cleanSongs(editingSetlist.sundaySchool?.songs),
              notes: editingSetlist.sundaySchool?.notes?.trim() || undefined,
            }
          : undefined,
      worshipService:
        setlistType === 'sunday'
          ? {
              songLeader: editingSetlist.worshipService?.songLeader?.trim() || '',
              songs: cleanSongs(editingSetlist.worshipService?.songs),
              notes: editingSetlist.worshipService?.notes?.trim() || undefined,
            }
          : undefined,
      program:
        setlistType !== 'sunday'
          ? {
              songLeader: editingSetlist.program?.songLeader?.trim() || '',
              songs: cleanSongs(editingSetlist.program?.songs),
              notes: editingSetlist.program?.notes?.trim() || undefined,
            }
          : undefined,
      generalNotes: editingSetlist.generalNotes?.trim() || undefined,
      createdAt: editingSetlist.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveInProgressRef.current = true;
    setIsSaving(true);
    try {
      if (await onSaveSetlist(finalSetlist)) {
        setIsEditing(false);
        setEditingSetlist(null);
        setEditPromptMsg(null);
        setSelectedSetlistId(finalSetlist.id);
        setExpandedSetlistIds([finalSetlist.id]);
      }
    } finally {
      saveInProgressRef.current = false;
      setIsSaving(false);
    }
  };

  const handleSelectSetlist = (id: string, e?: React.MouseEvent) => {
    setOpenMenuSetlistId(null);
    if (expandedSetlistIds.includes(id)) {
      setExpandedSetlistIds([]);
      setSelectedSetlistId(null);
    } else {
      if (e) {
        const cardEl = document.getElementById(`setlist-card-${id}`);
        if (cardEl) {
          scrollAnchorRef.current = {
            setlistId: id,
            initialScreenY: cardEl.getBoundingClientRect().top,
          };
        }
      }
      setSelectedSetlistId(id);
      setExpandedSetlistIds([id]);
      window.history.pushState({ tab: 'home', subView: 'detail', id }, '', '#home');
    }
  };

  return (
    <div className="ui-revamp ui-screen setlists-screen space-y-6">
      {sharePreview && setlists.some(item => item.id === sharePreview.id) && <SetlistShareDialog item={setlists.find(item => item.id === sharePreview.id)!} songs={songs} badge={sharePreview.badge} onClose={() => { const id = sharePreview.id; setSharePreview(null); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-setlist-actions="${id}"] button[title="Setlist actions"]`)?.focus({ preventScroll: true })); }} />}
      {reorder.error && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">{reorder.error}</p>}
      <span role="status" aria-live="polite" className="sr-only">{reorder.announcement || (reorder.busy ? 'Saving setlist order…' : '')}</span>
      {reorder.drag && createPortal(<div aria-hidden="true" className="pointer-events-none fixed z-[220] max-w-[80vw] rounded-xl border border-blue-400 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-xl dark:bg-slate-800 dark:text-white" style={{ left: Math.max(8, Math.min(reorder.drag.x + 12, window.innerWidth - 220)), top: reorder.drag.y + 12 }}>
        {setlists.find(item => item.id === reorder.drag!.id)?.title || 'Setlist'}
      </div>, document.body)}
      {searchQuery.trim() && searchSummaries.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" aria-live="polite">
          {searchSummaries.map((summary) => (
            <div key={`${summary.kind}-${summary.label.toLocaleLowerCase()}`} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 min-w-0">
              <div className="text-[10px] font-bold uppercase text-slate-500">{summary.kind}</div>
              <div className="font-semibold text-sm text-slate-900 dark:text-white break-words">{summary.label}</div>
              <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">{summary.detail}</div>
            </div>
          ))}
        </div>
      )}

      {/* Setlists Listing with In-Place Accordion Expansion */}
      <div className="space-y-3">


        {searchableSetlists.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
            {searchQuery.trim() ? 'No matching setlists.' : 'No setlists yet. Use + to start.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3" style={{ overflowAnchor: 'none' }}>
            {monthList(searchableSetlists, item => item.date, ['setlist', 'setlists']).render((item) => {
              const isPast = isPastDate(item.date);
              const today = isToday(item.date);
              const isSelected = expandedSetlistIds.includes(item.id);
              const isSoonest = !today && soonestUpcoming?.id === item.id;

              return (
                <div
                  key={item.id}
                  id={`setlist-card-${item.id}`}
                  data-setlist-drag-id={item.id}
                  aria-busy={reorder.busy || undefined}
                  style={reorder.drag?.id === item.id ? { opacity: .5 } : undefined}
                  data-upcoming-card={today ? 'today' : isSoonest ? 'next-up' : !isPast && !today && item.id === followingUpcoming?.id ? 'upcoming' : undefined}
                  className={`app-date-card relative p-3 min-w-0 rounded-2xl border transition-colors cursor-pointer ${openMenuSetlistId === item.id ? 'z-40' : 'z-0'} ${
                    isPast
                      ? `bg-slate-100/70 dark:bg-slate-900/40 text-slate-700 dark:text-slate-200 ${
                          isSelected
                            ? 'border-slate-400 dark:border-slate-600 ring-2 ring-slate-300 dark:ring-slate-700'
                            : 'border-slate-200/80 dark:border-slate-800/70'
                        }`
                    : isSelected
                      ? 'border-slate-900 dark:border-slate-100 ring-2 ring-slate-900 dark:ring-slate-100 bg-white dark:bg-slate-900 shadow-md'
                      : (today || isSoonest)
                      ? 'border-slate-400 dark:border-slate-500 ring-2 ring-slate-400/40 bg-slate-50/70 dark:bg-slate-800/40'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-400'
                  }`}
                >
                  {reorder.target?.id === item.id && <span aria-hidden="true" className={`pointer-events-none absolute inset-x-0 z-50 h-1 rounded-full bg-blue-500 ${reorder.target.edge === 'before' ? '-top-2' : '-bottom-2'}`} />}
                  {/* Card Header Row with Far-Right 3-Dots / Actions */}
                  <div data-setlist-card-header onClick={(e) => handleSelectSetlist(item.id, e)} className="flex items-center justify-between min-w-0">
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      {/* Date Badge */}
                      <CardDate date={item.date} />

                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <h4
                            className={`app-card-title min-w-0 truncate text-sm sm:text-base ${
                              isPast
                                ? 'font-bold text-slate-500 dark:text-slate-400'
                                : 'font-black text-slate-900 dark:text-white'
                            }`}
                          >
                            {item.title || ({ sunday: 'Sunday Service', prayer_meeting: 'Prayer Meeting', fellowship: 'Fellowship', event: 'Special Event' }[item.type || 'sunday'])}
                          </h4>

                          <UpcomingBadge status={today ? 'today' : isSoonest ? 'next-up' : !isPast && item.id === followingUpcoming?.id ? 'upcoming' : undefined} />

                        </div>

                        {/* Compact role summary: balanced on the line directly below title */}
                        <div
                          className="setlist-names app-card-secondary mt-1 flex flex-wrap items-center gap-x-1.5 text-slate-500 dark:text-slate-400"
                        >
                          <span className="min-w-0">
                            {item.presider || 'TBD'}
                          </span>
                          <span aria-hidden="true">•</span>
                          {item.type === 'sunday' || !item.type ? (
                            <>
                              <span className="min-w-0">
                                {item.sundaySchool?.songLeader || 'TBD'}
                              </span>
                              <span aria-hidden="true">•</span>
                              <span className="min-w-0">
                                {item.worshipService?.songLeader || 'TBD'}
                              </span>
                            </>
                          ) : (
                            <span className="min-w-0">
                              {item.program?.songLeader || 'TBD'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Far-right actions */}
                    <div
                      data-setlist-actions={item.id}
                      className="flex items-center space-x-1.5 text-slate-400 shrink-0 ml-2 relative"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {!isPast && reorder.canDrag(item) && <button {...reorder.handleProps(item)} aria-label={`Reorder ${item.title || 'setlist'} on ${item.date}. Drag or use arrow keys.`} className="flex h-11 w-8 shrink-0 touch-none items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-grab active:cursor-grabbing disabled:opacity-50"><GripVertical className="h-4 w-4" aria-hidden="true" /></button>}


                      <button
                        type="button"
                        onClick={() => setOpenMenuSetlistId((openId) => openId === item.id ? null : item.id)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                        title="Setlist actions"
                        aria-label={`Actions for ${item.title || item.date}`}
                        aria-expanded={openMenuSetlistId === item.id}
                      >
                        <MoreHorizontal className="w-5 h-5" />
                      </button>

                      {openMenuSetlistId === item.id && (
                        <div className="absolute right-0 top-full mt-1.5 w-48 max-w-[calc(100vw-2rem)] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-1.5 z-40 space-y-0.5">
                      <button
                        type="button"
                        onClick={(e) => handleCopySetlist(item, e)}
                        className={`w-full px-3.5 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-2 ${
                          copiedSetlistId === item.id
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                        title="Copy setlist for Messenger"
                      >
                        {copiedSetlistId === item.id ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hidden sm:inline">
                              Copied!
                            </span>
                          </>
                        ) : (
                          <><Copy className="w-4 h-4" /><span>Copy setlist</span></>
                        )}
                      </button>
                          <button type="button" onClick={() => { setOpenMenuSetlistId(null); setSharePreview({ id: item.id, badge: today ? 'Today' : isSoonest ? 'Next up' : item.id === followingUpcoming?.id ? 'Upcoming' : undefined }); }} className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"><Share2 className="w-3.5 h-3.5 text-slate-500" /><span>Share setlist</span></button>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuSetlistId(null);
                              handleStartEdit(item);
                            }}
                            className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuSetlistId(null);
                              if (confirm(`Remove this setlist for ${item.date}?`)) {
                                onDeleteSetlist(item.id);
                                if (selectedSetlistId === item.id) setSelectedSetlistId(null);
                              }
                            }}
                            className="w-full px-3.5 py-2 text-left text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* IN-PLACE EXPANDED ACCORDION CONTENT */}
                  {isSelected && (
                    <div
                      className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3 cursor-default"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Sunday Service Layout */}
                      {(!item.type || item.type === 'sunday') && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Presider & Service Header Badges */}
                          {(() => {

                            return (
                              <div className="md:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                <SetlistPerson role="Presider" name={item.presider} />

                                {/* Badges: Welcome Song & Closing Song (Linkage to Song Library!) */}
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                  {item.welcomeSong && (() => {
                                    const matchedSong = songs.find(
                                      (s) => s.title.trim().toLowerCase() === item.welcomeSong?.trim().toLowerCase()
                                    );
                                    return (
                                      <div
                                        onClick={() => (matchedSong ? handleOpenSong(matchedSong.id, item.id) : null)}
                                        className={`bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 ${
                                          matchedSong
                                            ? 'cursor-pointer hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors'
                                            : ''
                                        }`}
                                        title={matchedSong ? 'Click to open in Song Library' : undefined}
                                      >
                                        <span className="text-slate-500 dark:text-slate-400 font-semibold text-[11px]">Welcome:</span>
                                        <span
                                          className={`font-semibold text-slate-900 dark:text-white text-xs ${
                                            matchedSong
                                              ? 'hover:underline hover:text-slate-600 dark:hover:text-slate-300'
                                              : ''
                                          }`}
                                        >
                                          {matchedSong ? matchedSong.title : item.welcomeSong}
                                        </span>
                                      </div>
                                    );
                                  })()}

                                  {item.closingSong && (() => {
                                    const matchedSong = songs.find(
                                      (s) => s.title.trim().toLowerCase() === item.closingSong?.trim().toLowerCase()
                                    );
                                    return (
                                      <div
                                        onClick={() => (matchedSong ? handleOpenSong(matchedSong.id, item.id) : null)}
                                        className={`bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 ${
                                          matchedSong
                                            ? 'cursor-pointer hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors'
                                            : ''
                                        }`}
                                        title={matchedSong ? 'Click to open in Song Library' : undefined}
                                      >
                                        <span className="text-slate-500 dark:text-slate-400 font-semibold text-[11px]">Closing:</span>
                                        <span
                                          className={`font-semibold text-slate-900 dark:text-white text-xs ${
                                            matchedSong
                                              ? 'hover:underline hover:text-slate-600 dark:hover:text-slate-300'
                                              : ''
                                          }`}
                                        >
                                          {matchedSong ? matchedSong.title : item.closingSong}
                                        </span>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Sunday School Container */}
                          {(() => {

                            return (
                              <div className="border-t border-slate-200 dark:border-slate-700 pt-3 space-y-2">
                                <SetlistPerson role="Sunday School" name={item.sundaySchool?.songLeader} />

                                 <div className="space-y-1.5">
                                  {(item.sundaySchool?.songs || []).map((song, idx) => {
                                    const matchedSong =
                                      song.songId ? songs.find((s) => s.id === song.songId) : songs.find((s) => s.title.trim().toLowerCase() === song.title.trim().toLowerCase());
                                    const targetSongId = matchedSong ? matchedSong.id : song.songId;

                                    return (
                                      <div
                                        key={song.id || idx}
                                        onClick={() => (targetSongId ? handleOpenSong(targetSongId, item.id) : null)}
                                        className={`px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between transition-colors ${
                                          targetSongId
                                            ? 'cursor-pointer hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                                            : ''
                                        }`}
                                        title={targetSongId ? 'Click to open in Song Library' : undefined}
                                      >
                                        <span
                                          className={`text-xs font-semibold text-slate-900 dark:text-white truncate ${
                                            targetSongId
                                              ? 'hover:underline hover:text-slate-600 dark:hover:text-slate-300 transition-colors'
                                              : ''
                                          }`}
                                        >
                                          {idx + 1}. {matchedSong ? matchedSong.title : song.title}
                                        </span>
                                        {song.keyNote && (
                                          <span className="text-[10px] text-slate-400 font-medium shrink-0 ml-2">
                                            {song.keyNote}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Worship Service Container */}
                          {(() => {

                            return (
                              <div className="border-t border-slate-200 dark:border-slate-700 pt-3 space-y-2">
                                <SetlistPerson role="Worship Service" name={item.worshipService?.songLeader} />

                                 <div className="space-y-1.5">
                                  {(item.worshipService?.songs || []).map((song, idx) => {
                                    const matchedSong =
                                      song.songId ? songs.find((s) => s.id === song.songId) : songs.find((s) => s.title.trim().toLowerCase() === song.title.trim().toLowerCase());
                                    const targetSongId = matchedSong ? matchedSong.id : song.songId;

                                    return (
                                      <div
                                        key={song.id || idx}
                                        onClick={() => (targetSongId ? handleOpenSong(targetSongId, item.id) : null)}
                                        className={`px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between transition-colors ${
                                          targetSongId
                                            ? 'cursor-pointer hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                                            : ''
                                        }`}
                                        title={targetSongId ? 'Click to open in Song Library' : undefined}
                                      >
                                        <span
                                          className={`text-xs font-semibold text-slate-900 dark:text-white truncate ${
                                            targetSongId
                                              ? 'hover:underline hover:text-slate-600 dark:hover:text-slate-300 transition-colors'
                                              : ''
                                          }`}
                                        >
                                          {idx + 1}. {matchedSong ? matchedSong.title : song.title}
                                        </span>
                                        {song.keyNote && (
                                          <span className="text-[10px] text-slate-400 font-medium shrink-0 ml-2">
                                            {song.keyNote}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}

                                  {/* Theme Song in Worship Service */}
                                  {item.themeSong && (() => {
                                    const matchedSong = songs.find(
                                      (s) => s.title.trim().toLowerCase() === item.themeSong?.trim().toLowerCase()
                                    );
                                    const targetSongId = matchedSong ? matchedSong.id : undefined;
                                    const songNumber = (item.worshipService?.songs?.length || 0) + 1;

                                    return (
                                      <div
                                        onClick={() => (targetSongId ? handleOpenSong(targetSongId, item.id) : null)}
                                        className={`px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between transition-colors ${
                                          targetSongId
                                            ? 'cursor-pointer hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                                            : ''
                                        }`}
                                        title={targetSongId ? 'Click to open in Song Library' : undefined}
                                      >
                                        <div className="min-w-0 pr-2">
                                          <span
                                            className={`text-xs font-semibold text-slate-900 dark:text-white ${
                                              targetSongId
                                                ? 'hover:underline hover:text-slate-600 dark:hover:text-slate-300 transition-colors'
                                                : ''
                                            }`}
                                          >
                                            {songNumber}. {matchedSong ? matchedSong.title : item.themeSong} <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">(Theme Song)</span>
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* Non-Sunday Programs (Prayer Meeting, Fellowship, Event) */}
                      {item.type && item.type !== 'sunday' && (
                        <div className="space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-200 dark:border-slate-700 pb-2">
                            <div className="flex items-center space-x-3">
                              {item.presider && <SetlistPerson role="Presider" name={item.presider} />}
                              {item.program?.songLeader && <SetlistPerson role="Song Leader" name={item.program.songLeader} />}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              {item.welcomeSong && (() => {
                                const matchedSong = songs.find(
                                  (s) => s.title.trim().toLowerCase() === item.welcomeSong?.trim().toLowerCase()
                                );
                                return (
                                  <div
                                    onClick={() => (matchedSong ? handleOpenSong(matchedSong.id, item.id) : null)}
                                    className={`bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 ${
                                      matchedSong
                                        ? 'cursor-pointer hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors'
                                        : ''
                                    }`}
                                    title={matchedSong ? 'Click to open in Song Library' : undefined}
                                  >
                                    <span className="text-slate-500 dark:text-slate-400 font-semibold text-[11px]">Welcome:</span>
                                    <span
                                      className={`font-semibold text-slate-900 dark:text-white text-xs ${
                                        matchedSong
                                          ? 'hover:underline hover:text-slate-600 dark:hover:text-slate-300'
                                          : ''
                                      }`}
                                    >
                                      {matchedSong ? matchedSong.title : item.welcomeSong}
                                    </span>
                                  </div>
                                );
                              })()}

                              {item.closingSong && (() => {
                                const matchedSong = songs.find(
                                  (s) => s.title.trim().toLowerCase() === item.closingSong?.trim().toLowerCase()
                                );
                                return (
                                  <div
                                    onClick={() => (matchedSong ? handleOpenSong(matchedSong.id, item.id) : null)}
                                    className={`bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 ${
                                      matchedSong
                                        ? 'cursor-pointer hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors'
                                        : ''
                                    }`}
                                    title={matchedSong ? 'Click to open in Song Library' : undefined}
                                  >
                                    <span className="text-slate-500 dark:text-slate-400 font-semibold text-[11px]">Closing:</span>
                                    <span
                                      className={`font-semibold text-slate-900 dark:text-white text-xs ${
                                        matchedSong
                                          ? 'hover:underline hover:text-slate-600 dark:hover:text-slate-300'
                                          : ''
                                      }`}
                                    >
                                      {matchedSong ? matchedSong.title : item.closingSong}
                                    </span>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Program Songs */}
                          <div className="space-y-1.5">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                              Program Songs:
                            </span>
                            {(item.program?.songs || []).map((song, idx) => {
                              const matchedSong =
                                song.songId ? songs.find((s) => s.id === song.songId) : songs.find((s) => s.title.trim().toLowerCase() === song.title.trim().toLowerCase());
                              const targetSongId = matchedSong ? matchedSong.id : song.songId;

                              return (
                                <div
                                  key={song.id || idx}
                                  onClick={() => (targetSongId ? handleOpenSong(targetSongId, item.id) : null)}
                                  className={`px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between transition-colors ${
                                    targetSongId
                                      ? 'cursor-pointer hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                                      : ''
                                  }`}
                                  title={targetSongId ? 'Click to open in Song Library' : undefined}
                                >
                                  <span
                                    className={`text-xs font-semibold text-slate-900 dark:text-white truncate ${
                                      targetSongId
                                        ? 'hover:underline hover:text-slate-600 dark:hover:text-slate-300 transition-colors'
                                        : ''
                                    }`}
                                  >
                                    {idx + 1}. {matchedSong ? matchedSong.title : song.title}
                                  </span>
                                  {song.keyNote && (
                                    <span className="text-[10px] text-slate-400 font-medium shrink-0 ml-2">
                                      {song.keyNote}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}


                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Form Modal */}
      {isEditing && editingSetlist && (
        <div role="dialog" aria-modal="true" className="ui-form-screen fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-4">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                <span>
                  {editingSetlist.type === 'prayer_meeting'
                    ? 'Edit Prayer Meeting Program'
                    : editingSetlist.type === 'fellowship'
                    ? 'Edit Fellowship Program'
                    : editingSetlist.type === 'event'
                    ? 'Edit Special Event Program'
                    : 'Edit Sunday Setlist Program'}
                </span>
              </h3>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => {
                  setIsEditing(false);
                  setEditingSetlist(null);
                  setEditPromptMsg(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Back swipe warning toast/banner */}
            {editPromptMsg && (
              <div
                className={`mx-4 sm:mx-5 mt-4 p-3 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
                  editPromptMsg.type === 'warn'
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300'
                    : 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900 text-indigo-800 dark:text-indigo-300'
                }`}
              >
                {editPromptMsg.type === 'warn' ? (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                ) : (
                  <CheckCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{editPromptMsg.message}</span>
              </div>
            )}

            <form onSubmit={handleSave} autoComplete="off" data-form-type="other" className="ui-modal-form">
              <span className="sr-only" role="status">{songReorder.announcement}</span>
              {songReorder.error && <p role="alert" className="text-sm text-red-500">{songReorder.error}</p>}

              <div className="ui-form-body">
              <SetlistEditorSection title="Service Details" initialOpen colorClass={COLOR_PALETTE.sky.textBold}>
              {/* Date & Title */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="setlist-scheduled-date" className="sr-only">
                    Scheduled date
                  </label>
                  <input
                    id="setlist-scheduled-date"
                    name="scheduled_calendar_date"
                    type="date"
                    required
                    value={editingSetlist.date || ''}
                    onChange={(e) => {
                      const newDate = e.target.value;
                      setEditingSetlist({
                        ...editingSetlist,
                        date: newDate,
                      });
                    }}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm"
                  />
                </div>

                {editingSetlist.type === 'event' || editingSetlist.type === 'fellowship' || editingSetlist.type === 'prayer_meeting' ? (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                      {editingSetlist.type === 'event'
                        ? 'Event Title *'
                        : editingSetlist.type === 'fellowship'
                        ? 'Fellowship Group Name *'
                        : 'Prayer Meeting Title'}
                    </label>
                    <input
                      id="setlist-event-title"
                      name="program_event_title"
                      type="text"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="sentences"
                      spellCheck={false}
                      data-form-type="other"
                      data-lpignore="true"
                      required={editingSetlist.type === 'event' || editingSetlist.type === 'fellowship'}
                      value={editingSetlist.title || ''}
                      onChange={(e) => setEditingSetlist({ ...editingSetlist, title: e.target.value })}
                      placeholder={
                        editingSetlist.type === 'event'
                          ? 'Enter event title'
                          : editingSetlist.type === 'fellowship'
                          ? 'Enter fellowship title'
                          : 'Enter setlist title'
                      }
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col justify-end">
                    {!showCustomTitle && !editingSetlist.title ? (
                      <div className="flex items-center min-h-9">
                        <button
                          type="button"
                          onClick={() => setShowCustomTitle(true)}
                          className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Custom Setlist Title</span>
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                            SETLIST TITLE
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setShowCustomTitle(false);
                              setEditingSetlist({ ...editingSetlist, title: undefined });
                            }}
                            className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline cursor-pointer"
                          >
                            Remove custom title
                          </button>
                        </div>
                        <input
                          id="setlist-custom-title"
                          name="program_custom_title"
                          type="text"
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="sentences"
                          spellCheck={false}
                          data-form-type="other"
                          data-lpignore="true"
                          value={editingSetlist.title || ''}
                          onChange={(e) => setEditingSetlist({ ...editingSetlist, title: e.target.value })}
                          placeholder="Enter setlist title"
                          className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Presider & Special Songs Container */}
              {editingSetlist.type !== 'prayer_meeting' && (() => {
                const presiderColor = getPersonColor(editingSetlist.presider);
                return (
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-3.5">
                    {/* Presider */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className={`block text-xs font-semibold uppercase tracking-wider ${presiderColor.text}`}>
                          Presider
                        </label>
                      </div>
                      <div className="p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700">
                        <AutofillInput
                          value={editingSetlist.presider || ''}
                          onChange={(val) => setEditingSetlist({ ...editingSetlist, presider: val })}
                          suggestions={directoryNames}
                          placeholder="Enter presider's name"
                          inputClassName="p-1.5 text-xs sm:text-sm text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                  {/* Welcome Song & Closing Song */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                    {/* Welcome Song Selection */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          Welcome Song
                        </label>
                      </div>

                      <div className="p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-xs">
                        <AutofillInput
                          value={editingSetlist.welcomeSong ?? 'Napakaligaya'}
                          onChange={(val) => setEditingSetlist({ ...editingSetlist, welcomeSong: val })}
                          suggestions={songTitleSuggestions}
                          allSuggestions={songTitleSuggestions}
                          defaultValue="Napakaligaya"
                          songs={songs}
                          selectedSongTitles={selectedSetlistSongTitles}
                          showAllOnFocus
                          setlists={setlists}
                          showLastSung={false}
                          placeholder="Type or select welcome song..."
                          inputClassName="p-1.5 text-xs sm:text-sm text-slate-900 dark:text-white font-medium"
                        />
                      </div>
                    </div>

                    {/* Closing Song Selection */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          Closing Song
                        </label>
                      </div>

                      <div className="p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-xs">
                        <AutofillInput
                          value={editingSetlist.closingSong ?? 'Give Thanks'}
                          onChange={(val) => setEditingSetlist({ ...editingSetlist, closingSong: val })}
                          suggestions={songTitleSuggestions}
                          allSuggestions={songTitleSuggestions}
                          defaultValue="Give Thanks"
                          songs={songs}
                          selectedSongTitles={selectedSetlistSongTitles}
                          showAllOnFocus
                          setlists={setlists}
                          showLastSung={false}
                          placeholder="Type or select closing song..."
                          inputClassName="p-1.5 text-xs sm:text-sm text-slate-900 dark:text-white font-medium"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Theme Song (Sunday Setlist) */}
                  {(!editingSetlist.type || editingSetlist.type === 'sunday') && (
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                          <span>Theme Song</span>
                        </label>
                      </div>
                      <div className="p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700">
                        <AutofillInput
                          value={editingSetlist.themeSong || ''}
                          onChange={(val) => setEditingSetlist({ ...editingSetlist, themeSong: val })}
                          suggestions={songTitleSuggestions}
                          allSuggestions={songTitleSuggestions}
                          songs={songs}
                          selectedSongTitles={selectedSetlistSongTitles}
                          showAllOnFocus
                          setlists={setlists}
                          showLastSung={false}
                          placeholder="Type or select theme song..."
                          inputClassName="p-1.5 text-xs sm:text-sm text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

              </SetlistEditorSection>
              {/* Sunday School & Worship Service Forms (Sunday Setlist) */}
              {(!editingSetlist.type || editingSetlist.type === 'sunday') && (
                <>
                  {/* Sunday School Section */}
                  {(() => {
                    const ssSectionColor = COLOR_PALETTE.amber;
                    return (
                      <SetlistEditorSection title="Sunday School" colorClass={ssSectionColor.textBold}>


                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Song Leader
                          </label>
                          <div className="p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700">
                            <AutofillInput
                              value={editingSetlist.sundaySchool?.songLeader || ''}
                              onChange={(val) =>
                                setEditingSetlist({
                                  ...editingSetlist,
                                  sundaySchool: {
                                    ...editingSetlist.sundaySchool!,
                                    songLeader: val,
                                    songs: editingSetlist.sundaySchool?.songs || [],
                                  },
                                })
                              }
                              suggestions={directoryNames}
                              placeholder="Choose song leader"
                              inputClassName="p-1.5 text-xs sm:text-sm text-slate-900 dark:text-white"
                            />
                          </div>
                        </div>

                    {/* Compact Stacked Song Fields with Numbers Right Before */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                          Songs:
                        </span>
                        {(editingSetlist.sundaySchool?.songs?.length || 0) < 3 && (
                          <button
                            type="button"
                            onClick={() => {
                              const curr = editingSetlist.sundaySchool?.songs || [];
                              setEditingSetlist({
                                ...editingSetlist,
                                sundaySchool: {
                                  ...editingSetlist.sundaySchool!,
                                  songs: [...curr, { id: generateUUID(), title: '' }],
                                },
                              });
                            }}
                            className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Song</span>
                          </button>
                        )}
                      </div>

                      {(editingSetlist.sundaySchool?.songs || []).map((s, idx) => (
                        <div key={s.id || idx} {...songRowProps(`sundaySchool:${s.id || idx}`)}>
                          {songDragHandle('sundaySchool', idx)}
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 w-5 shrink-0 text-right">
                            {idx + 1}.
                          </span>
                          <div className="flex-1 p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700">
                            <AutofillInput
                              value={s.title}
                              onChange={(val) => handleUpdateSongSlot('sundaySchool', idx, val)}
                              suggestions={songTitleSuggestions}
                              songs={songs}
                              selectedSongTitles={selectedSetlistSongTitles}
                          showAllOnFocus
                              setlists={setlists}
                              showSongCategoryFilters
                              songFilter={songPickerFilter}
                              onSongFilterChange={setSongPickerFilter}
                              placeholder="Song Title"
                              inputClassName="p-1.5 text-xs sm:text-sm text-slate-900 dark:text-white"
                            />
                          </div>

                          {(editingSetlist.sundaySchool?.songs?.length || 0) > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = (editingSetlist.sundaySchool?.songs || []).filter((_, i) => i !== idx);
                                setEditingSetlist({
                                  ...editingSetlist,
                                  sundaySchool: { ...editingSetlist.sundaySchool!, songs: updated },
                                });
                              }}
                              className="p-2 text-rose-500 hover:text-rose-700 shrink-0 cursor-pointer"
                              title="Delete song"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </SetlistEditorSection>
                );
              })()}

                  {/* Worship Service Section */}
                  {(() => {
                    const wsSectionColor = COLOR_PALETTE.indigo;
                    return (
                      <SetlistEditorSection title="Worship Service" colorClass={wsSectionColor.textBold}>


                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Song Leader
                          </label>
                          <div className="p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700">
                            <AutofillInput
                              value={editingSetlist.worshipService?.songLeader || ''}
                              onChange={(val) =>
                                setEditingSetlist({
                                  ...editingSetlist,
                                  worshipService: {
                                    ...editingSetlist.worshipService!,
                                    songLeader: val,
                                    songs: editingSetlist.worshipService?.songs || [],
                                  },
                                })
                              }
                              suggestions={directoryNames}
                              placeholder="Choose song leader"
                              inputClassName="p-1.5 text-xs sm:text-sm text-slate-900 dark:text-white"
                            />
                          </div>
                        </div>

                    {/* Compact Stacked Song Fields with Numbers Right Before */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                          Songs:
                        </span>
                        {(editingSetlist.worshipService?.songs?.length || 0) < 4 && (
                          <button
                            type="button"
                            onClick={() => {
                              const curr = editingSetlist.worshipService?.songs || [];
                              setEditingSetlist({
                                ...editingSetlist,
                                worshipService: {
                                  ...editingSetlist.worshipService!,
                                  songs: [...curr, { id: generateUUID(), title: '' }],
                                },
                              });
                            }}
                            className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Song</span>
                          </button>
                        )}
                      </div>

                      {(editingSetlist.worshipService?.songs || []).map((s, idx) => (
                        <div key={s.id || idx} {...songRowProps(`worshipService:${s.id || idx}`)}>
                          {songDragHandle('worshipService', idx)}
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 w-5 shrink-0 text-right">
                            {idx + 1}.
                          </span>
                          <div className="flex-1 p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700">
                            <AutofillInput
                              value={s.title}
                              onChange={(val) => handleUpdateSongSlot('worshipService', idx, val)}
                              suggestions={songTitleSuggestions}
                              songs={songs}
                              selectedSongTitles={selectedSetlistSongTitles}
                          showAllOnFocus
                              setlists={setlists}
                              showSongCategoryFilters
                              songFilter={songPickerFilter}
                              onSongFilterChange={setSongPickerFilter}
                              placeholder="Song Title"
                              inputClassName="p-1.5 text-xs sm:text-sm text-slate-900 dark:text-white"
                            />
                          </div>

                          {(editingSetlist.worshipService?.songs?.length || 0) > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = (editingSetlist.worshipService?.songs || []).filter((_, i) => i !== idx);
                                setEditingSetlist({
                                  ...editingSetlist,
                                  worshipService: { ...editingSetlist.worshipService!, songs: updated },
                                });
                              }}
                              className="p-2 text-rose-500 hover:text-rose-700 shrink-0 cursor-pointer"
                              title="Delete song"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </SetlistEditorSection>
                );
              })()}
                </>
              )}

              {/* Non-Sunday Program Editor (Prayer Meeting, Fellowship, Event) */}
              {editingSetlist.type && editingSetlist.type !== 'sunday' && (() => {

                return (
                  <SetlistEditorSection title="Program Songs" colorClass={COLOR_PALETTE.indigo.textBold}>


                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Song Leader
                      </label>
                      <div className="p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700">
                        <AutofillInput
                          value={editingSetlist.program?.songLeader || ''}
                          onChange={(val) =>
                            setEditingSetlist({
                              ...editingSetlist,
                              program: {
                                ...editingSetlist.program!,
                                songLeader: val,
                                songs: editingSetlist.program?.songs || [],
                              },
                            })
                          }
                          suggestions={directoryNames}
                          placeholder="Enter song leader's name"
                          inputClassName="p-1.5 text-xs sm:text-sm text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                  {/* Compact Stacked Song Fields with Numbers Right Before */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        Songs:
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const curr = editingSetlist.program?.songs || [];
                          setEditingSetlist({
                            ...editingSetlist,
                            program: {
                              ...editingSetlist.program!,
                              songs: [...curr, { id: generateUUID(), title: '' }],
                            },
                          });
                        }}
                        className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Song</span>
                      </button>
                    </div>

                    {(editingSetlist.program?.songs || []).map((s, idx) => (
                      <div key={s.id || idx} {...songRowProps(`program:${s.id || idx}`)}>
                          {songDragHandle('program', idx)}
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 w-5 shrink-0 text-right">
                          {idx + 1}.
                        </span>
                        <div className="flex-1 p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700">
                          <AutofillInput
                            value={s.title}
                            onChange={(val) => handleUpdateSongSlot('program', idx, val)}
                            suggestions={songTitleSuggestions}
                            songs={songs}
                            selectedSongTitles={selectedSetlistSongTitles}
                          showAllOnFocus
                            setlists={setlists}
                            showSongCategoryFilters
                            songFilter={songPickerFilter}
                            onSongFilterChange={setSongPickerFilter}
                            placeholder="Song Title"
                            inputClassName="p-1.5 text-xs sm:text-sm text-slate-900 dark:text-white"
                          />
                        </div>

                        {(editingSetlist.program?.songs?.length || 0) > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = (editingSetlist.program?.songs || []).filter((_, i) => i !== idx);
                              setEditingSetlist({
                                ...editingSetlist,
                                program: { ...editingSetlist.program!, songs: updated },
                              });
                            }}
                            className="p-2 text-rose-500 hover:text-rose-700 shrink-0 cursor-pointer"
                            title="Delete song"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </SetlistEditorSection>
              );
            })()}

              </div>
              <div className="ui-form-actions flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    setIsEditing(false);
                    setEditingSetlist(null);
                    setEditPromptMsg(null);
                  }}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white text-white shadow-xs cursor-pointer"
                >
                  {isSaving ? 'Saving…' : 'Save Setlist Program'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!isEditing && (
        <div onClick={(event) => event.stopPropagation()}>
          {showTypeSelector && (
            <div className="fixed bottom-36 right-4 sm:right-6 md:right-8 z-40 w-[min(20rem,calc(100vw-2rem))] bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl py-1.5 divide-y divide-slate-100 dark:divide-slate-800">
              <button type="button" onClick={handleStartCreateSunday} className="w-full px-4 py-2.5 text-left text-xs sm:text-sm text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer"><Calendar className="w-4 h-4 text-blue-500 shrink-0" /><span className="font-semibold">Sunday Service</span></button>
              <button type="button" onClick={() => handleStartCreateOther('prayer_meeting')} className="w-full px-4 py-2.5 text-left text-xs sm:text-sm text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer"><Flame className="w-4 h-4 text-sky-500 shrink-0" /><span className="font-semibold">Midweek Prayer Meeting</span></button>
              <button type="button" onClick={() => handleStartCreateOther('fellowship')} className="w-full px-4 py-2.5 text-left text-xs sm:text-sm text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer"><Users className="w-4 h-4 text-indigo-500 shrink-0" /><span className="font-semibold">Fellowship Gathering</span></button>
              <button type="button" onClick={() => handleStartCreateOther('event')} className="w-full px-4 py-2.5 text-left text-xs sm:text-sm text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer"><Sparkles className="w-4 h-4 text-emerald-500 shrink-0" /><span className="font-semibold">Special Event</span></button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowTypeSelector((isOpen) => !isOpen)}
            aria-expanded={showTypeSelector}
            aria-label="New setlist"
            title="New setlist"
            className="app-fab fixed bottom-20 sm:bottom-22 right-4 sm:right-6 md:right-8 z-30 w-14 h-14 rounded-2xl bg-slate-900 hover:bg-slate-800 active:scale-95 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 shadow-xl shadow-slate-900/30 dark:shadow-black/50 border border-slate-700/20 dark:border-slate-200/30 flex items-center justify-center transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white focus:ring-offset-2"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>
        </div>
      )}
    </div>
  );
};
