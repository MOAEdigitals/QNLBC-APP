import React, { useState, useEffect } from 'react';
import { DatabaseStatusInfo, TableSyncStatus } from '../types';
import {
  Database,
  Cloud,
  CloudOff,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Clock,
  ExternalLink,
  X,
  Radio,
  Calendar,
  Music,
  Cake,
  Heart,
  Users,
  Award,
  Mic,
  Users2,
  Headphones,
  Shield,
  Sliders,
  Disc,
} from 'lucide-react';

interface DatabaseStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  statusInfo?: DatabaseStatusInfo | any;
}

const TABLE_ICONS: Record<string, React.ReactNode> = {
  setlists: <Calendar className="w-4 h-4 text-indigo-500" />,
  songs: <Music className="w-4 h-4 text-emerald-500" />,
  birthdays: <Cake className="w-4 h-4 text-pink-500" />,
  anniversaries: <Heart className="w-4 h-4 text-rose-500" />,
  visitors: <Users className="w-4 h-4 text-sky-500" />,
  special_recognitions: <Award className="w-4 h-4 text-purple-500" />,
  special_numbers: <Mic className="w-4 h-4 text-amber-500" />,
  choir_entries: <Users2 className="w-4 h-4 text-teal-500" />,
  practices: <Headphones className="w-4 h-4 text-cyan-500" />,
  practice_entries: <Headphones className="w-4 h-4 text-cyan-500" />,
  profiles: <Shield className="w-4 h-4 text-blue-500" />,
  users: <Shield className="w-4 h-4 text-blue-500" />,
  saved_names: <Users className="w-4 h-4 text-indigo-400" />,
  welcome_songs: <Music className="w-4 h-4 text-purple-400" />,
};

function formatRelativeTime(timestamp: number | null, now: number): string {
  if (!timestamp) return 'Never synced';
  const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (diffSec < 5) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatExactTime(timestamp: number | null): string {
  if (!timestamp) return 'No sync recorded';
  const d = new Date(timestamp);
  return (
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
    ' • ' +
    d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
  );
}

export const FirestoreStatusModal: React.FC<DatabaseStatusModalProps> = ({
  isOpen,
  onClose,
  statusInfo,
}) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const status = statusInfo?.status || 'connected';
  const isOnline = status === 'connected' || status === 'online';
  const isConnecting = status === 'connecting';
  const tables: TableSyncStatus[] = statusInfo?.tables || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Supabase Database & Realtime Status
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Authoritative multi-device cloud synchronizer
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Banner */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs">
            <div className="flex items-center space-x-3">
              {isOnline ? (
                <div className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </div>
              ) : isConnecting ? (
                <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
              ) : (
                <CloudOff className="w-4 h-4 text-rose-500" />
              )}
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    {isOnline
                      ? 'Connected & Synchronized'
                      : isConnecting
                      ? 'Connecting to Supabase...'
                      : 'Disconnected / Offline'}
                  </span>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      isOnline
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                        : isConnecting
                        ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                        : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    {statusInfo?.realtimeActive ? 'Realtime: ON' : 'REST'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {statusInfo?.errorMessage
                    ? statusInfo.errorMessage
                    : isOnline
                    ? 'All tables are bound to PostgreSQL realtime replication.'
                    : 'Changes will sync once connection is restored.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tables Sync Status List */}
        <div className="p-5 flex-1 overflow-y-auto space-y-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Active Supabase Tables ({tables.length})
            </span>
            <span className="text-[11px] text-slate-400 flex items-center">
              <Clock className="w-3 h-3 mr-1" />
              Auto-refreshes live
            </span>
          </div>

          {tables.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              Initializing table listeners...
            </div>
          ) : (
            <div className="space-y-1.5">
              {tables.map((tbl) => (
                <div
                  key={tbl.name}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0">
                      {TABLE_ICONS[tbl.name] || <Database className="w-4 h-4 text-slate-400" />}
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 capitalize">
                        {tbl.name.replace(/_/g, ' ')}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center space-x-1.5">
                        <span>{formatRelativeTime(tbl.lastSyncTime, now)}</span>
                        {tbl.error && (
                          <span className="text-rose-500 font-medium truncate">• {tbl.error}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {tbl.itemCount} {tbl.itemCount === 1 ? 'row' : 'rows'}
                    </div>
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                      active
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            PostgreSQL • Row-Level Security • RPC Soft-Deletes
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
