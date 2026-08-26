import React from 'react';
import { UserAccount, AppTab } from '../types';
import { Church } from 'lucide-react';
import { formatDateStr, getTodayStr } from '../utils/dateUtils';

interface NavbarProps {
  currentUser: UserAccount | null;
  users?: UserAccount[];
  currentTab: AppTab;
  onNavigateToSettings: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentUser, onNavigateToSettings }) => {
  const todayStr = getTodayStr();

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-slate-100 flex items-center justify-center text-white dark:text-slate-900 shadow-sm shrink-0">
            <Church className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
                New Life Baptist Church
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Quezon, Nueva Ecija • {formatDateStr(todayStr, { showDayOfWeek: false, shortMonth: true })}
            </p>
          </div>
        </div>

        {currentUser && (
          <button
            onClick={onNavigateToSettings}
            className="flex items-center space-x-2 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors border border-slate-200/60 dark:border-slate-700/60 cursor-pointer select-none"
            title="User Profile & Settings"
          >
            {/* Single Current User Profile Picture */}
            <div className="w-7 h-7 rounded-full ring-2 ring-white dark:ring-slate-900 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white flex items-center justify-center text-xs font-bold overflow-hidden shrink-0 shadow-xs">
              {currentUser.avatar ? (
                <img
                  src={currentUser.avatar}
                  alt={currentUser.username}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{currentUser.username.substring(0, 1).toUpperCase()}</span>
              )}
            </div>

            <span className="font-semibold text-slate-900 dark:text-white">{currentUser.username}</span>
            {currentUser.role === 'admin' && (
              <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                Admin
              </span>
            )}
          </button>
        )}
      </div>
    </header>
  );
};
