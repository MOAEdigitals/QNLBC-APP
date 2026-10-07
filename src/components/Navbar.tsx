import React, { useEffect, useRef, useState } from 'react';
import { UserAccount, AppTab } from '../types';
import { ChurchLogo } from './ChurchLogo';
import { Search, X } from 'lucide-react';
import { useHeaderSearchContext } from './HeaderSearch';

interface NavbarProps {
  currentUser: UserAccount | null;
  users?: UserAccount[];
  currentTab: AppTab;
  onNavigateToSettings: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  currentTab,
  onNavigateToSettings,
}) => {
  const { search } = useHeaderSearchContext();
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setIsSearching(false); }, [currentTab, search?.label]);
  useEffect(() => { if (isSearching) inputRef.current?.focus(); }, [isSearching]);
  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-4xl mx-auto px-4 py-2 flex min-h-12 items-center justify-between gap-3">
        {isSearching && search ? (
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-950">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input ref={inputRef} type="search" name="header_search" autoComplete="off" autoCorrect="off" autoCapitalize="sentences" spellCheck={false} data-form-type="other" data-lpignore="true" value={search.value} onChange={(event) => search.onChange(event.target.value)} placeholder={search.placeholder} aria-label={search.label} className="min-h-11 min-w-0 flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400 dark:text-white [&::-webkit-search-cancel-button]:hidden" />
            <button type="button" onClick={() => setIsSearching(false)} aria-label="Close search" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
          </div>
        ) : <div className="flex items-center space-x-3">
          <div className="w-8 h-8 shrink-0 overflow-hidden">
            <ChurchLogo className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">
                New Life Baptist Church
              </h1>
            </div>
          </div>
        </div>}

        {!isSearching && <div className="flex items-center space-x-2">
          {search && <button type="button" onClick={() => setIsSearching(true)} aria-label="Search" title="Search" className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"><Search className="h-5 w-5" /></button>}
          {currentUser && (
            <button
              onClick={onNavigateToSettings}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors border border-slate-200/60 dark:border-slate-700/60 cursor-pointer select-none"
              title="User Profile & Settings"
            >
              <div className="w-7 h-7 rounded-full ring-2 ring-white dark:ring-slate-900 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white flex items-center justify-center text-xs font-bold overflow-hidden shrink-0 shadow-xs">
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
