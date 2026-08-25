import React, { useState, useEffect } from 'react';
import { UserAccount, AppTab } from '../types';
import { Church } from 'lucide-react';
import { getTodayStr, formatDateStr } from '../utils/dateUtils';
import { subscribeToPresence } from '../utils/presence';

interface NavbarProps {
  currentUser: UserAccount | null;
  users?: UserAccount[];
  currentTab: AppTab;
  onNavigateToSettings: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentUser, users = [], onNavigateToSettings }) => {
  const todayStr = getTodayStr();
  const [onlineUsers, setOnlineUsers] = useState<UserAccount[]>(() =>
    currentUser ? [currentUser] : []
  );

  useEffect(() => {
    if (!currentUser) {
      setOnlineUsers([]);
      return;
    }

    const unsubscribe = subscribeToPresence(currentUser, users, (activeList) => {
      setOnlineUsers(activeList);
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser, users]);

  const firstTwoUsers = onlineUsers.slice(0, 2);
  const remainingCount = onlineUsers.length > 2 ? onlineUsers.length - 2 : 0;

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
            {/* Circular Profile Pictures Stack of currently online users */}
            <div className="flex items-center -space-x-2 mr-1">
              {firstTwoUsers.map((u, idx) => (
                <div
                  key={u.id}
                  className="w-7 h-7 rounded-full ring-2 ring-white dark:ring-slate-900 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white flex items-center justify-center text-[10px] font-bold overflow-hidden shrink-0 shadow-xs"
                  title={`${u.username}${u.id === currentUser.id ? ' (You - Online)' : ' (Online)'}`}
                  style={{ zIndex: 10 - idx }}
                >
                  {u.avatar ? (
                    <img
                      src={u.avatar}
                      alt={u.username}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{u.username.substring(0, 1).toUpperCase()}</span>
                  )}
                </div>
              ))}

              {/* 3rd circle: overlapping +# indicator for other active webapp users */}
              {remainingCount > 0 && (
                <div
                  className="w-7 h-7 rounded-full ring-2 ring-white dark:ring-slate-900 bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 flex items-center justify-center text-[10px] font-bold shrink-0 shadow-xs"
                  style={{ zIndex: 5 }}
                  title={`${remainingCount} more online user${remainingCount > 1 ? 's' : ''}: ${onlineUsers
                    .slice(2)
                    .map((u) => u.username)
                    .join(', ')}`}
                >
                  +{remainingCount}
                </div>
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
