import React, { useState, useEffect } from 'react';
import {
  FirestoreStatusInfo,
  CollectionSyncLogEntry,
  reconcileAllLocalDataToCloud,
  flushPendingSyncQueue,
} from '../firestoreSync';
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
  ArrowDownUp,
} from 'lucide-react';

interface FirestoreStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  statusInfo: FirestoreStatusInfo;
}

const COLLECTION_ICONS: Record<string, React.ReactNode> = {
  setlists: <Calendar className="w-4 h-4 text-indigo-500" />,
  songs: <Music className="w-4 h-4 text-emerald-500" />,
  birthdays: <Cake className="w-4 h-4 text-pink-500" />,
  anniversaries: <Heart className="w-4 h-4 text-rose-500" />,
  visitors: <Users className="w-4 h-4 text-sky-500" />,
  special_recognitions: <Award className="w-4 h-4 text-amber-500" />,
  special_numbers: <Mic className="w-4 h-4 text-purple-500" />,
  choir_entries: <Users2 className="w-4 h-4 text-teal-500" />,
  practice_entries: <Headphones className="w-4 h-4 text-cyan-500" />,
  users: <Shield className="w-4 h-4 text-blue-500" />,
  app_settings: <Sliders className="w-4 h-4 text-amber-600" />,
  saved_names: <Users className="w-4 h-4 text-indigo-400" />,
  welcome_songs: <Music className="w-4 h-4 text-purple-400" />,
  practice_audios: <Disc className="w-4 h-4 text-violet-500" />,
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
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
    ' • ' +
    d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export const FirestoreStatusModal: React.FC<FirestoreStatusModalProps> = ({
  isOpen,
  onClose,
  statusInfo,
}) => {
  const [now, setNow] = useState(Date.now());
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Live tick every second to keep relative times accurate ("just now", "12s ago")
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const logs: CollectionSyncLogEntry[] = Object.values(statusInfo.collectionLogs || {});
  const isOnline = statusInfo.status === 'online';
  const isQuota = statusInfo.status === 'quota-exceeded';
  const isOffline = statusInfo.status === 'offline';

  const handleManualSync = async () => {
    setIsSyncingNow(true);
    setSyncFeedback(null);
    try {
      await flushPendingSyncQueue();
      await reconcileAllLocalDataToCloud();
      setSyncFeedback('All collections and queued changes checked with server.');
      setTimeout(() => setSyncFeedback(null), 3500);
    } catch (err: any) {
      setSyncFeedback('Sync check completed: ' + (err.message || 'Offline mode active'));
      setTimeout(() => setSyncFeedback(null), 4000);
    } finally {
      setIsSyncingNow(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Firestore Cloud Sync Status
                </h3>
                {isOnline && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Online & Synced
                  </span>
                )}
                {isQuota && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    Free Quota Limit Reached
                  </span>
                )}
                {isOffline && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                    <CloudOff className="w-3 h-3 text-slate-500" />
                    Offline Mode
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Real-time collection listener timestamps & server synchronization logs
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Highlight Banner */}
        <div className="px-5 py-3 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Last Global Sync:</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {statusInfo.lastGlobalSyncTime
                  ? formatRelativeTime(statusInfo.lastGlobalSyncTime, now)
                  : 'Active'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
              <ArrowDownUp className="w-3.5 h-3.5 text-slate-400" />
              <span>Pending Local Queue:</span>
              <span
                className={`font-bold ${
                  statusInfo.pendingQueueCount > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {statusInfo.pendingQueueCount} items
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncingNow}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingNow ? 'animate-spin' : ''}`} />
            <span>{isSyncingNow ? 'Verifying Sync...' : 'Check Server Sync'}</span>
          </button>
        </div>

        {syncFeedback && (
          <div className="px-5 py-2 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{syncFeedback}</span>
          </div>
        )}

        {/* Collection Sync Timestamps List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5 divide-y divide-slate-100 dark:divide-slate-800/60">
          <div className="pb-1 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
            <span>Collection / Data Type</span>
            <div className="flex items-center gap-8">
              <span>Items</span>
              <span>Last Server Sync</span>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            {logs.map((item) => {
              const icon = COLLECTION_ICONS[item.collection] || (
                <Database className="w-4 h-4 text-slate-400" />
              );

              return (
                <div
                  key={item.collection}
                  className="p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200/60 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                >
                  <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                    <div className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shrink-0 shadow-2xs">
                      {icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                          {item.displayName}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          /{item.collection}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span className="truncate">{item.lastAction || 'Snapshot listener active'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                    <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {item.itemCount} {item.itemCount === 1 ? 'record' : 'records'}
                    </span>

                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center justify-end gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        <span>{formatRelativeTime(item.lastSyncTimestamp, now)}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500">
                        {formatExactTime(item.lastSyncTimestamp)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer info & Console Link */}
        <div className="px-5 py-3.5 bg-slate-50/90 dark:bg-slate-900/90 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400 shrink-0">
          <div className="flex items-center gap-1.5 text-center sm:text-left">
            <Radio className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>Duplex Firestore listeners stay open in the background for real-time multi-device sync.</span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <a
              href={statusInfo.databaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
            >
              <span>Firebase Cloud Console</span>
              <ExternalLink className="w-3 h-3" />
            </a>

            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs cursor-pointer transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
