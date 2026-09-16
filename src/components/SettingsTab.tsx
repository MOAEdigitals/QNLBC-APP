import React, { useState, useMemo } from 'react';
import { UserAccount, DatabaseStatusInfo } from '../types';
import {
  cleanupLegacyStorage,
  exportChurchDataJSON,
  importBatchLyricsTxt,
} from '../utils/storage';
import {
  saveSong as supabaseSaveSong,
  saveSetlist as supabaseSaveSetlist,
  saveBirthday as supabaseSaveBirthday,
  saveAnniversary as supabaseSaveAnniversary,
  saveVisitor as supabaseSaveVisitor,
  saveSpecialRecognition as supabaseSaveSpecialRecognition,
  saveSpecialNumber as supabaseSaveSpecialNumber,
  savePracticeEntry as supabaseSavePracticeEntry,
  saveChoirEntry as supabaseSaveChoirEntry,
  saveMinistrySavedNames as supabaseSaveMinistrySavedNames,
  setProfileRole,
  toggleProfileActive,
  updateUserProfile,
} from '../services/supabaseData';
import { compressImageToAvatar } from '../utils/imageUtils';
import {
  Settings,
  Sun,
  Moon,
  UserCheck,
  Download,
  Upload,
  LogOut,
  CheckCircle,
  AlertCircle,
  Users,
  Plus,
  Trash2,
  Database,
  FileText,
  Music,
  ChevronDown,
  Camera,
  Check,
  Search,
  Key,
  Shield,
  Clock,
  Radio,
  ExternalLink,
  CheckCircle2,
  RefreshCw,
  Copy,
  Code2,
  UserX,
  X,
} from 'lucide-react';
import { MIGRATION_PROMPT_TEXT } from '../data/migrationPrompt';

interface SettingsTabProps {
  currentUser: UserAccount;
  onUpdateCurrentUser: (user: UserAccount) => void;
  users: UserAccount[];
  onUpdateUsers: (users: UserAccount[]) => void;
  savedNames?: string[];
  onUpdateSavedNames?: (names: string[]) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onSignOut: () => void;
  onDataReset: () => void;
  databaseStatus?: DatabaseStatusInfo;
  firestoreStatus?: any;
  onOpenDatabaseStatusModal?: () => void;
  onOpenFirestoreStatusModal?: () => void;
  appData?: {
    songs: any[];
    setlists: any[];
    birthdays: any[];
    anniversaries: any[];
    visitors: any[];
    specialRecognitions: any[];
    specialNumbers: any[];
    practiceEntries?: any[];
    choirEntries?: any[];
    savedNames: string[];
    welcomeSongs?: string[];
  };
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  currentUser,
  onUpdateCurrentUser,
  users,
  onUpdateUsers,
  savedNames: propSavedNames = [],
  onUpdateSavedNames,
  theme,
  onToggleTheme,
  onSignOut,
  onDataReset,
  databaseStatus,
  firestoreStatus,
  onOpenDatabaseStatusModal,
  onOpenFirestoreStatusModal,
  appData,
}) => {
  // Collapsible section states
  const [isAccountCollapsed, setIsAccountCollapsed] = useState(false);
  const [isAppearanceCollapsed, setIsAppearanceCollapsed] = useState(false);
  const [isUserDatabaseCollapsed, setIsUserDatabaseCollapsed] = useState(true);
  const [isChurchDirectoryCollapsed, setIsChurchDirectoryCollapsed] = useState(true);
  const [isDataBackupCollapsed, setIsDataBackupCollapsed] = useState(true);
  const [isSyncLogsCollapsed, setIsSyncLogsCollapsed] = useState(true);

  // Profile avatar feedback
  const [avatarNoticeMsg, setAvatarNoticeMsg] = useState<string | null>(null);

  // User management filtering
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'admin' | 'user'>('all');
  const [managingUserId, setManagingUserId] = useState<string | null>(null);

  // Church directory names state
  const [savedNames, setSavedNames] = useState<string[]>(propSavedNames);
  React.useEffect(() => {
    setSavedNames(propSavedNames);
  }, [propSavedNames]);

  const [newNameInput, setNewNameInput] = useState('');
  const [importStatus, setImportStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [lyricsImportStatus, setLyricsImportStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [cleanStorageStatus, setCleanStorageStatus] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Export & prompt modals
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);

  const isAdmin = currentUser.role === 'admin';
  const statusObj = databaseStatus || firestoreStatus;
  const handleOpenStatusModal = onOpenDatabaseStatusModal || onOpenFirestoreStatusModal;

  // Handle avatar upload for current user
  const handleAvatarChange = async (file: File) => {
    try {
      const avatarBase64 = await compressImageToAvatar(file);
      const updated = { ...currentUser, avatar: avatarBase64 };
      onUpdateCurrentUser(updated);
      await updateUserProfile(currentUser.id, { avatar_url: avatarBase64 });
      setAvatarNoticeMsg('Profile picture updated successfully!');
      setTimeout(() => setAvatarNoticeMsg(null), 4000);
    } catch (err: any) {
      alert('Failed to process image: ' + err.message);
    }
  };

  // Directory Name Management
  const handleAddDirectoryName = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newNameInput.trim();
    if (!trimmed) return;
    if (savedNames.some((n) => n.toLowerCase() === trimmed.toLowerCase())) {
      alert('This name already exists in the church directory.');
      return;
    }
    const updated = [...savedNames, trimmed].sort();
    setSavedNames(updated);
    setNewNameInput('');
    if (onUpdateSavedNames) onUpdateSavedNames(updated);
  };

  const handleDeleteDirectoryName = (nameToDelete: string) => {
    const updated = savedNames.filter((n) => n !== nameToDelete);
    setSavedNames(updated);
    if (onUpdateSavedNames) onUpdateSavedNames(updated);
  };

  // Targeted Legacy Storage Cleanup
  const handlePurgeLegacyStorage = () => {
    const clearedCount = cleanupLegacyStorage();
    setCleanStorageStatus(
      `Cleaned up obsolete browser cache keys (${clearedCount} removed). Supabase session and personal display preferences preserved.`
    );
    setTimeout(() => setCleanStorageStatus(null), 5000);
  };

  // Toggle user role
  const handleToggleUserRole = async (targetUser: UserAccount) => {
    if (targetUser.id === currentUser.id) {
      if (!confirm('Are you sure you want to change your own role? You may lose admin privileges.')) {
        return;
      }
    }
    const nextRole = targetUser.role === 'admin' ? 'user' : 'admin';
    setManagingUserId(targetUser.id);
    try {
      await setProfileRole(targetUser.id, nextRole);
      onUpdateUsers(
        users.map((u) => (u.id === targetUser.id ? { ...u, role: nextRole } : u))
      );
      if (targetUser.id === currentUser.id) {
        onUpdateCurrentUser({ ...currentUser, role: nextRole });
      }
    } catch (err: any) {
      alert('Failed to update role: ' + (err.message || 'Error'));
    } finally {
      setManagingUserId(null);
    }
  };

  // Toggle user active/deactivated
  const handleToggleUserActive = async (targetUser: UserAccount) => {
    if (targetUser.id === currentUser.id) {
      alert('You cannot deactivate your own account.');
      return;
    }
    const nextActive = !targetUser.active;
    const actionLabel = nextActive ? 'activate' : 'deactivate';
    if (!confirm(`Are you sure you want to ${actionLabel} ${targetUser.username}?`)) {
      return;
    }

    setManagingUserId(targetUser.id);
    try {
      await toggleProfileActive(targetUser.id, nextActive);
      onUpdateUsers(
        users.map((u) => (u.id === targetUser.id ? { ...u, active: nextActive } : u))
      );
    } catch (err: any) {
      alert(`Failed to ${actionLabel} user: ` + (err.message || 'Error'));
    } finally {
      setManagingUserId(null);
    }
  };

  // Export JSON Backup
  const handleExportBackup = () => {
    if (!appData) {
      alert('No data available to export.');
      return;
    }
    exportChurchDataJSON(appData);
  };

  // Import JSON Backup directly to Supabase
  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportStatus({ success: true, message: 'Parsing backup JSON file...' });

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        setImportStatus({
          success: true,
          message: 'Restoring records directly to Supabase...',
        });

        // Restore songs
        if (Array.isArray(parsed.songs)) {
          for (const s of parsed.songs) {
            await supabaseSaveSong(s).catch(console.error);
          }
        }

        // Restore setlists
        if (Array.isArray(parsed.setlists)) {
          for (const s of parsed.setlists) {
            await supabaseSaveSetlist(s).catch(console.error);
          }
        }

        // Restore celebrants
        if (Array.isArray(parsed.birthdays)) {
          for (const b of parsed.birthdays) {
            await supabaseSaveBirthday(b).catch(console.error);
          }
        }
        if (Array.isArray(parsed.anniversaries)) {
          for (const a of parsed.anniversaries) {
            await supabaseSaveAnniversary(a).catch(console.error);
          }
        }
        if (Array.isArray(parsed.visitors)) {
          for (const v of parsed.visitors) {
            await supabaseSaveVisitor(v).catch(console.error);
          }
        }
        if (Array.isArray(parsed.specialRecognitions)) {
          for (const r of parsed.specialRecognitions) {
            await supabaseSaveSpecialRecognition(r).catch(console.error);
          }
        }
        if (Array.isArray(parsed.specialNumbers)) {
          for (const sn of parsed.specialNumbers) {
            await supabaseSaveSpecialNumber(sn).catch(console.error);
          }
        }
        if (Array.isArray(parsed.practiceEntries)) {
          for (const p of parsed.practiceEntries) {
            await supabaseSavePracticeEntry(p).catch(console.error);
          }
        }
        if (Array.isArray(parsed.choirEntries)) {
          for (const c of parsed.choirEntries) {
            await supabaseSaveChoirEntry(c).catch(console.error);
          }
        }
        if (Array.isArray(parsed.savedNames)) {
          await supabaseSaveMinistrySavedNames(parsed.savedNames).catch(console.error);
          if (onUpdateSavedNames) onUpdateSavedNames(parsed.savedNames);
        }

        setImportStatus({
          success: true,
          message: 'All church records restored and synchronized with Supabase successfully!',
        });

        onDataReset();
      } catch (err: any) {
        setImportStatus({ success: false, message: 'Failed to restore: ' + err.message });
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Batch Lyrics Import
  const handleBatchLyricsImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const res = await importBatchLyricsTxt(files);
      const msg = `Successfully processed ${files.length} file(s): added ${res.importedCount} new song(s), updated ${res.updatedCount} existing song(s). Total songs: ${res.totalSongs}.`;
      setLyricsImportStatus({ success: true, message: msg });
      onDataReset();
    } catch (err: any) {
      setLyricsImportStatus({ success: false, message: 'Failed to process files: ' + err.message });
    }
    e.target.value = '';
  };

  // AI Studio Migration prompt helpers
  const handleCopyPromptText = () => {
    navigator.clipboard.writeText(MIGRATION_PROMPT_TEXT);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 3000);
  };

  const handleDownloadPromptMd = () => {
    const blob = new Blob([MIGRATION_PROMPT_TEXT], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'qnlbc_migration_prompt.md';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadSourceZip = async () => {
    setIsDownloadingZip(true);
    try {
      const response = await fetch('/api/download-source-zip');
      if (!response.ok) throw new Error('Failed to generate archive');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qnlbc_source_${new Date().toISOString().split('T')[0]}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e: any) {
      alert('Could not download zip: ' + (e.message || 'Error'));
    } finally {
      setIsDownloadingZip(false);
    }
  };

  // Filtered users for table rendering
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.username.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        (u.name && u.name.toLowerCase().includes(userSearchQuery.toLowerCase()));
      const matchesRole =
        userRoleFilter === 'all'
          ? true
          : userRoleFilter === 'admin'
          ? u.role === 'admin'
          : u.role !== 'admin';
      return matchesSearch && matchesRole;
    });
  }, [users, userSearchQuery, userRoleFilter]);

  return (
    <div className="space-y-5 max-w-3xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-800 dark:text-slate-200" />
            <span>Settings</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {isAdmin
              ? 'Account profile, team roles, church directory autofill, and Supabase data management'
              : 'Theme appearance and account session settings'}
          </p>
        </div>
      </div>

      {/* Container 1: Current Account Profile & Session */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-all">
        <div
          onClick={() => setIsAccountCollapsed(!isAccountCollapsed)}
          className="p-4 sm:p-5 flex items-center justify-between gap-3 cursor-pointer select-none group hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-900 shrink-0">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Account Profile & Session</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Logged in as <span className="font-semibold text-slate-700 dark:text-slate-300">{currentUser.name || currentUser.username}</span> ({currentUser.role === 'admin' ? 'Administrator' : 'Worship Team Member'})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSignOut();
              }}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
            <div className="p-1 rounded-lg text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-all">
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isAccountCollapsed ? '' : 'rotate-180'}`} />
            </div>
          </div>
        </div>

        {!isAccountCollapsed && (
          <div className="p-4 sm:p-5 pt-0 space-y-4 border-t border-slate-100 dark:border-slate-800">
            {avatarNoticeMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-start gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{avatarNoticeMsg}</span>
              </div>
            )}

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="relative shrink-0">
                <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-full ring-3 ring-white dark:ring-slate-800 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 flex items-center justify-center font-bold text-xl overflow-hidden shadow-xs">
                  {currentUser.avatar ? (
                    <img
                      src={currentUser.avatar}
                      alt={currentUser.username}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{currentUser.username.substring(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <label
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 ring-2 ring-white dark:ring-slate-800 flex items-center justify-center shadow-xs cursor-pointer hover:scale-105 transition-transform"
                  title="Change profile picture"
                >
                  <Camera className="w-3 h-3" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleAvatarChange(f);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">
                    {currentUser.name || currentUser.username}
                  </h4>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      currentUser.role === 'admin'
                        ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                        : 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                    }`}
                  >
                    {currentUser.role === 'admin' ? 'Administrator' : 'Team Member'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  {currentUser.username}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                  Connected with Supabase Cloud Authentication.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Container 2: Appearance & Theme */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-all">
        <div
          onClick={() => setIsAppearanceCollapsed(!isAppearanceCollapsed)}
          className="p-4 sm:p-5 flex items-center justify-between gap-3 cursor-pointer select-none group hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900 shrink-0">
              {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Appearance & Display
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Current theme: <span className="font-semibold capitalize">{theme}</span> mode
              </p>
            </div>
          </div>

          <div className="p-1 rounded-lg text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-all">
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isAppearanceCollapsed ? '' : 'rotate-180'}`} />
          </div>
        </div>

        {!isAppearanceCollapsed && (
          <div className="p-4 sm:p-5 pt-0 space-y-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div>
                <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white block">
                  Color Theme
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Switch between Light and Dark interface modes
                </span>
              </div>
              <button
                type="button"
                onClick={onToggleTheme}
                className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 transition-colors flex items-center gap-2 cursor-pointer shadow-2xs"
              >
                {theme === 'dark' ? (
                  <>
                    <Sun className="w-4 h-4 text-amber-500" />
                    <span>Light Mode</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 text-slate-700" />
                    <span>Dark Mode</span>
                  </>
                )}
              </button>
            </div>

            {/* Targeted Cache & Legacy Storage Tool */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white block">
                  Purge Legacy Local Storage Cache
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 block">
                  Removes obsolete version keys without clearing your current session or display preferences.
                </span>
              </div>
              <button
                type="button"
                onClick={handlePurgeLegacyStorage}
                className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-semibold shrink-0 cursor-pointer transition-colors"
              >
                Clean Legacy Cache
              </button>
            </div>
            {cleanStorageStatus && (
              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{cleanStorageStatus}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Container 3: Church Team Members & Roles (Admin Only) */}
      {isAdmin && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-all">
          <div
            onClick={() => setIsUserDatabaseCollapsed(!isUserDatabaseCollapsed)}
            className="p-4 sm:p-5 flex items-center justify-between gap-3 cursor-pointer select-none group hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900 shrink-0">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    Team Members & Roles
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    {users.length} {users.length === 1 ? 'Member' : 'Members'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Manage accounts, grant administrator access, or deactivate users.
                </p>
              </div>
            </div>

            <div className="p-1 rounded-lg text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-all">
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isUserDatabaseCollapsed ? '' : 'rotate-180'}`} />
            </div>
          </div>

          {!isUserDatabaseCollapsed && (
            <div className="p-4 sm:p-5 pt-0 space-y-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                {/* Search */}
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                  {userSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setUserSearchQuery('')}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Filter */}
                <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
                  <button
                    type="button"
                    onClick={() => setUserRoleFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      userRoleFilter === 'all'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    All ({users.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserRoleFilter('admin')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      userRoleFilter === 'admin'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Admins ({users.filter((u) => u.role === 'admin').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserRoleFilter('user')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      userRoleFilter === 'user'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Members ({users.filter((u) => u.role !== 'admin').length})
                  </button>
                </div>
              </div>

              {/* Members Table */}
              <div className="border border-slate-200 dark:border-slate-700/80 rounded-xl overflow-hidden shadow-2xs bg-white dark:bg-slate-900">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-3 w-10 text-center text-slate-400">#</th>
                        <th className="p-3">Member</th>
                        <th className="p-3">Role</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-slate-400">
                            No team members found matching your search.
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((u, idx) => {
                          const isCurrent = u.id === currentUser.id;
                          const isManaging = managingUserId === u.id;

                          return (
                            <tr
                              key={u.id}
                              className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                            >
                              <td className="p-3 text-center text-slate-400 font-mono text-[11px]">
                                {idx + 1}
                              </td>

                              <td className="p-3">
                                <div className="flex items-center gap-2.5 min-w-[160px]">
                                  <div className="w-8 h-8 rounded-full ring-1 ring-slate-200 dark:ring-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center justify-center font-bold text-[11px] overflow-hidden shrink-0">
                                    {u.avatar ? (
                                      <img
                                        src={u.avatar}
                                        alt={u.username}
                                        referrerPolicy="no-referrer"
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <span>{u.username.substring(0, 2).toUpperCase()}</span>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-bold text-slate-900 dark:text-white truncate">
                                        {u.name || u.username}
                                      </span>
                                      {isCurrent && (
                                        <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400">
                                          (You)
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[11px] text-slate-400 font-mono block truncate">
                                      {u.username}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              <td className="p-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                    u.role === 'admin'
                                      ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                  }`}
                                >
                                  {u.role === 'admin' ? 'Admin' : 'Member'}
                                </span>
                              </td>

                              <td className="p-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                    u.active !== false
                                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                      : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                  }`}
                                >
                                  {u.active !== false ? 'Active' : 'Deactivated'}
                                </span>
                              </td>

                              <td className="p-3 text-right">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    disabled={isManaging}
                                    onClick={() => handleToggleUserRole(u)}
                                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
                                    title={`Toggle role to ${u.role === 'admin' ? 'member' : 'admin'}`}
                                  >
                                    {u.role === 'admin' ? 'Make Member' : 'Make Admin'}
                                  </button>

                                  {!isCurrent && (
                                    <button
                                      type="button"
                                      disabled={isManaging}
                                      onClick={() => handleToggleUserActive(u)}
                                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                                        u.active !== false
                                          ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 border-rose-200 dark:border-rose-900'
                                          : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 border-emerald-200 dark:border-emerald-900'
                                      }`}
                                      title={u.active !== false ? 'Deactivate user' : 'Activate user'}
                                    >
                                      {u.active !== false ? 'Deactivate' : 'Activate'}
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                User accounts and passwords are encrypted with bcrypt by Supabase Auth and never stored in plaintext.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Container 4: Church Directory & Autofill Suggestions (Admin Only) */}
      {isAdmin && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-all">
          <div
            onClick={() => setIsChurchDirectoryCollapsed(!isChurchDirectoryCollapsed)}
            className="p-4 sm:p-5 flex items-center justify-between gap-3 cursor-pointer select-none group hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-900 shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    Church Directory & Autofill
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    {savedNames.length} {savedNames.length === 1 ? 'Name' : 'Names'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Autofill suggestions across Presiders, Song Leaders, and Special Numbers.
                </p>
              </div>
            </div>

            <div className="p-1 rounded-lg text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-all">
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isChurchDirectoryCollapsed ? '' : 'rotate-180'}`} />
            </div>
          </div>

          {!isChurchDirectoryCollapsed && (
            <div className="p-4 sm:p-5 pt-0 space-y-4 border-t border-slate-100 dark:border-slate-800">
              <form onSubmit={handleAddDirectoryName} className="flex items-center gap-2 pt-2">
                <input
                  type="text"
                  value={newNameInput}
                  onChange={(e) => setNewNameInput(e.target.value)}
                  placeholder="Enter church member name (e.g. Bro. Juan Dela Cruz)..."
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs sm:text-sm font-semibold flex items-center gap-1.5 shrink-0 hover:bg-slate-800 cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Name</span>
                </button>
              </form>

              {savedNames.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-2 max-h-56 overflow-y-auto p-1">
                  {savedNames.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 shadow-2xs"
                    >
                      <span>{name}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteDirectoryName(name)}
                        className="text-slate-400 hover:text-rose-500 p-0.5 cursor-pointer transition-colors"
                        title={`Remove ${name}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
                  Church directory is empty. Add names above to enable autofill across all forms.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Container 5: Data Library & Backup Tools (Admin Only) */}
      {isAdmin && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-all">
          <div
            onClick={() => setIsDataBackupCollapsed(!isDataBackupCollapsed)}
            className="p-4 sm:p-5 flex items-center justify-between gap-3 cursor-pointer select-none group hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 shrink-0">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  Data Library & Backup Tools
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Export backups, restore from JSON files, and batch import song lyrics.
                </p>
              </div>
            </div>

            <div className="p-1 rounded-lg text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-all">
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isDataBackupCollapsed ? '' : 'rotate-180'}`} />
            </div>
          </div>

          {!isDataBackupCollapsed && (
            <div className="p-4 sm:p-5 pt-0 space-y-5 border-t border-slate-100 dark:border-slate-800">
              {/* Batch Lyrics Import */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Batch Import Lyrics (.txt files)</span>
                </h4>

                {lyricsImportStatus && (
                  <div
                    className={`p-3.5 rounded-xl border flex items-start gap-2 text-xs font-semibold ${
                      lyricsImportStatus.success
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                        : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300'
                    }`}
                  >
                    {lyricsImportStatus.success ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <span>{lyricsImportStatus.message}</span>
                  </div>
                )}

                <label className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-left hover:border-slate-400 dark:hover:border-slate-500 transition-all flex items-start space-x-3 cursor-pointer shadow-xs">
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 shrink-0">
                    <Music className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-bold text-slate-900 dark:text-white block">
                      Select Multiple .txt Files
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 block">
                      Choose multiple .txt files (1 text file = 1 song). The file name becomes the song title and text becomes the lyrics.
                    </span>
                    <input
                      type="file"
                      multiple
                      accept=".txt,text/plain"
                      onChange={handleBatchLyricsImport}
                      className="hidden"
                    />
                  </div>
                </label>
              </div>

              {/* Full Backup & Restore */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5" />
                  <span>Full Data Export & Restore (JSON)</span>
                </h4>

                {importStatus && (
                  <div
                    className={`p-3.5 rounded-xl border flex items-start gap-2 text-xs font-semibold ${
                      importStatus.success
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                        : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300'
                    }`}
                  >
                    {importStatus.success ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <span>{importStatus.message}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <button
                    type="button"
                    onClick={handleExportBackup}
                    className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-left hover:border-slate-400 dark:hover:border-slate-500 transition-all flex items-start space-x-3 cursor-pointer shadow-xs"
                  >
                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 shrink-0">
                      <Download className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-slate-900 dark:text-white block">
                        Export All Data (JSON)
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 block">
                        Download full JSON backup of songs, setlists, and directory entries.
                      </span>
                    </div>
                  </button>

                  <label className={`p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-left hover:border-slate-400 dark:hover:border-slate-500 transition-all flex items-start space-x-3 cursor-pointer shadow-xs ${isImporting ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 shrink-0">
                      {isImporting ? (
                        <RefreshCw className="w-5 h-5 text-emerald-600 animate-spin" />
                      ) : (
                        <Upload className="w-5 h-5 text-emerald-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-bold text-slate-900 dark:text-white block">
                        {isImporting ? 'Restoring Records...' : 'Restore JSON Backup'}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 block">
                        Upload JSON backup to restore and synchronize across all devices.
                      </span>
                      <input
                        type="file"
                        accept=".json,application/json"
                        disabled={isImporting}
                        onChange={handleImportBackup}
                        className="hidden"
                      />
                    </div>
                  </label>
                </div>
              </div>

              {/* Developer / Migration Utilities */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                <div className="p-4 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/60 flex flex-col justify-between space-y-3">
                  <div className="flex items-start space-x-3">
                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-900 shrink-0">
                      <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-bold text-slate-900 dark:text-white block">
                        Migration Prompt (.md)
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 block">
                        Full prompt and schema specification for new environments.
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={handleDownloadPromptMd}
                      className="flex-1 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors shadow-xs cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download .md</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyPromptText}
                      className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-purple-300 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-slate-750 text-purple-700 dark:text-purple-300 text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                    >
                      {copiedPrompt ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-600 font-bold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Prompt</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/60 flex flex-col justify-between space-y-3">
                  <div className="flex items-start space-x-3">
                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900 shrink-0">
                      <Code2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-bold text-slate-900 dark:text-white block">
                        Download Codebase (.ZIP)
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 block">
                        Full codebase archive for local backup or offline testing.
                      </span>
                    </div>
                  </div>
                  <div className="pt-1">
                    <button
                      type="button"
                      disabled={isDownloadingZip}
                      onClick={handleDownloadSourceZip}
                      className="w-full px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors shadow-xs cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{isDownloadingZip ? 'Preparing Zip...' : 'Download Codebase (.ZIP)'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Container 6: Supabase Realtime Connection & Status */}
      {statusObj && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-all">
          <div
            onClick={() => setIsSyncLogsCollapsed(!isSyncLogsCollapsed)}
            className="p-4 sm:p-5 flex items-center justify-between gap-3 cursor-pointer select-none group hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 shrink-0">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    Supabase Database Connection
                  </h3>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Realtime Active
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Realtime Postgres replication and authoritative cloud database.
                </p>
              </div>
            </div>

            <div className="p-1 rounded-lg text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-all">
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isSyncLogsCollapsed ? '' : 'rotate-180'}`} />
            </div>
          </div>

          {!isSyncLogsCollapsed && (
            <div className="p-4 sm:p-5 pt-0 space-y-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Realtime listeners connected to authoritative Supabase tables.</span>
                </div>

                {handleOpenStatusModal && (
                  <button
                    type="button"
                    onClick={handleOpenStatusModal}
                    className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200/80 dark:border-indigo-800/60 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>Open Live Sync Monitor</span>
                  </button>
                )}
              </div>

              {/* Compact Collection Sync List */}
              {statusObj.collectionLogs && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {Object.entries(statusObj.collectionLogs).map(([tbl, log]: [string, any]) => {
                    const timeDisplay = log.lastSyncTimestamp
                      ? new Date(log.lastSyncTimestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })
                      : 'Connected';

                    return (
                      <div
                        key={tbl}
                        className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                            {log.displayName || tbl}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                            /{tbl}
                          </span>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="flex items-center justify-end gap-1 text-[11px] font-bold text-slate-800 dark:text-slate-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                            <span>{timeDisplay}</span>
                          </div>
                          <span className="text-[9px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500">
                            Synced
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Migration Prompt Modal */}
      {showPromptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 w-full max-w-3xl max-h-[85vh] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  AI Studio Migration Prompt & Specification
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPromptModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto font-mono text-xs text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-950/50 whitespace-pre-wrap selection:bg-purple-500 selection:text-white">
              {MIGRATION_PROMPT_TEXT}
            </div>
            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={handleCopyPromptText}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                {copiedPrompt ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Copied to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Entire Prompt</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleDownloadPromptMd}
                className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download .md</span>
              </button>
              <button
                type="button"
                onClick={() => setShowPromptModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
