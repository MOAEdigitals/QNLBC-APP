import React from 'react';
import { UserAccount, AppTab, DatabaseStatusInfo } from '../types';
import { ChurchLogo } from './ChurchLogo';
import { Cloud, CloudOff, AlertTriangle } from 'lucide-react';

interface NavbarProps {
  currentUser: UserAccount | null;
  users?: UserAccount[];
  currentTab: AppTab;
  onNavigateToSettings: () => void;
  databaseStatus?: DatabaseStatusInfo;
  firestoreStatus?: any;
  onOpenFirestoreStatusModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onNavigateToSettings,
  databaseStatus,
  firestoreStatus,
  onOpenFirestoreStatusModal,
}) => {
  const statusObj = databaseStatus || firestoreStatus;
  const isOnline = statusObj?.status === 'online' || statusObj?.status === 'connected';
  const isConnecting = statusObj?.status === 'connecting';
  const isOffline = statusObj?.status === 'offline' || statusObj?.status === 'error';

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-4xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
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
        </div>

        <div className="flex items-center space-x-2">
          {onOpenFirestoreStatusModal && (
            <button
              type="button"
              onClick={onOpenFirestoreStatusModal}
              className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer select-none shadow-2xs ${
                isOnline
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/50'
                  : isConnecting
                  ? 'bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200/80 dark:border-blue-800/60 hover:bg-blue-100/70'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
              title="View connection status"
              aria-label="View connection status"
            >
              {isOnline ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="hidden sm:inline">Connected</span>
                  <Cloud className="w-3.5 h-3.5 sm:hidden text-emerald-600 dark:text-emerald-400" />
                </>
              ) : isConnecting ? (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="hidden sm:inline">Connecting</span>
                </>
              ) : (
                <>
                  <CloudOff className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="hidden sm:inline">Offline</span>
                </>
              )}
            </button>
          )}

          {currentUser && (
            <button
              onClick={onNavigateToSettings}
              className="flex items-center space-x-2 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors border border-slate-200/60 dark:border-slate-700/60 cursor-pointer select-none"
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

              <span className="font-semibold text-slate-900 dark:text-white hidden sm:inline">
                {currentUser.displayName || currentUser.username}
              </span>
              {currentUser.role === 'admin' && (
                <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                  Admin
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
