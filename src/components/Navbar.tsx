import React, { useEffect, useRef, useState } from 'react';
import { UserAccount, AppTab } from '../types';
import { Search, X, Bell } from 'lucide-react';
import { useHeaderSearchContext } from './HeaderSearch';

const TAB_LABELS: Record<AppTab, string> = {
  home: 'Setlists',
  recognitions: 'Recognitions',
  'special-numbers': 'Schedules',
  songs: 'Songs',
  outlines: 'Outlines',
  settings: 'Profile',
};

interface NavbarProps {
  currentUser: UserAccount | null;
  users?: UserAccount[];
  currentTab: AppTab;
  onNavigateToSettings: () => void;
  onOpenNotifications?: () => void;
  unreadNotifications?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  currentTab,
  onNavigateToSettings,
  onOpenNotifications,
  unreadNotifications = 0,
}) => {
  const { search } = useHeaderSearchContext();
  const [isSearchOpened, setIsSearching] = useState(false);
  // A filter must never remain active behind a collapsed search button.
  const isSearching = Boolean(search && (isSearchOpened || search.value.length > 0));
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const focusRequestedRef = useRef(false);
  useEffect(() => { setIsSearching(false); }, [currentTab, search?.label]);
  useEffect(() => {
    if (isSearchOpened && focusRequestedRef.current) inputRef.current?.focus();
    focusRequestedRef.current = false;
  }, [isSearchOpened]);
  useEffect(() => {
    if (!isSearching || search?.value.length) return;
    const dismiss = (event: PointerEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) setIsSearching(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [isSearching, search?.value]);
  return (
    <header data-app-header className="sticky top-0 z-30 bg-white dark:bg-slate-950 transition-colors">
      <div className="max-w-4xl mx-auto px-4 py-2 flex min-h-12 items-center justify-between gap-3">
        {isSearching && search ? (
          <div ref={searchRef} className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-950">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input ref={inputRef} type="search" name="header_search" autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} data-form-type="other" data-lpignore="true" value={search.value} onChange={(event) => search.onChange(event.target.value)} onKeyDown={(event) => {
              if (event.key !== 'Escape') return;
              // Prevent native search inputs from silently clearing the active query.
              event.preventDefault();
              if (search.value.length) inputRef.current?.blur();
              else setIsSearching(false);
            }} placeholder={search.placeholder} aria-label={search.label} className="min-h-11 min-w-0 flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400 dark:text-white [&::-webkit-search-cancel-button]:hidden" />
            <button type="button" onPointerDown={(event) => event.preventDefault()} onClick={() => { setIsSearching(true); search.onChange(''); }} aria-label="Clear search" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
          </div>
        ) : <div className="flex items-center space-x-3">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-white leading-tight">
                {TAB_LABELS[currentTab]}
              </h1>
            </div>
          </div>
        </div>}

        {!isSearching && <div className="flex items-center space-x-2">
          {onOpenNotifications && <button type="button" onClick={onOpenNotifications} aria-label={`Notifications${unreadNotifications ? `, ${unreadNotifications} unread` : ''}`} className="relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"><Bell className="h-5 w-5" />{unreadNotifications > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-indigo-600 px-1.5 text-[10px] font-bold text-white">{unreadNotifications > 99 ? '99+' : unreadNotifications}</span>}</button>}
          {search?.beforeSearch}
          {search && <button type="button" onClick={() => { focusRequestedRef.current = true; setIsSearching(true); }} aria-label="Search" title="Search" className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"><Search className="h-5 w-5" /></button>}
          {currentUser && (
            <button
              onClick={onNavigateToSettings}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors border border-slate-200/60 dark:border-slate-700/60 cursor-pointer select-none"
              title="User Profile & Settings"
            >
              <div className="w-7 h-7 rounded-full ring-2 ring-white dark:ring-slate-950 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white flex items-center justify-center text-xs font-bold overflow-hidden shrink-0 shadow-xs">
                {currentUser.avatar || currentUser.avatarUrl ? (
                  <img
                    src={currentUser.avatar || currentUser.avatarUrl}
                    alt={currentUser.displayName || currentUser.username}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{currentUser.username.substring(0, 1).toUpperCase()}</span>
                )}
              </div>
            </button>
          )}
        </div>}
      </div>
    </header>
  );
};

