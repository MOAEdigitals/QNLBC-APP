import React, { useState } from 'react';
import { UserAccount } from '../types';
import {
  saveUsers,
  updateUserAvatar,
  DEFAULT_ADMIN,
  resetAppToDefaults,
  exportChurchDataJSON,
  importChurchDataJSON,
  importBatchLyricsTxt,
  loadSavedNames,
  saveSavedNames,
  loadSongs,
  loadSetlists,
  loadBirthdays,
  loadAnniversaries,
  loadVisitors,
  loadSpecialRecognitions,
  loadSpecialNumbers,
} from '../utils/storage';
import {
  syncSaveUser,
  syncDeleteUser,
  syncSaveSavedNames,
  syncSaveSong,
  syncSaveSetlist,
  syncSaveBirthday,
  syncSaveAnniversary,
  syncSaveVisitor,
  syncSaveSpecialRecognition,
  syncSaveSpecialNumber,
} from '../firestoreSync';
import { compressImageToAvatar } from '../utils/imageUtils';
import {
  Settings,
  Sun,
  Moon,
  ShieldCheck,
  UserPlus,
  Download,
  Upload,
  RotateCcw,
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
  Image as ImageIcon,
  Copy,
  Check,
  UserCheck,
} from 'lucide-react';

interface SettingsTabProps {
  currentUser: UserAccount;
  onUpdateCurrentUser: (updatedUser: UserAccount) => void;
  users: UserAccount[];
  onUpdateUsers: (updatedUsers: UserAccount[]) => void;
  savedNames?: string[];
  onUpdateSavedNames?: (names: string[]) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onSignOut: () => void;
  onDataReset: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  currentUser,
  onUpdateCurrentUser,
  users,
  onUpdateUsers,
  savedNames: propSavedNames,
  onUpdateSavedNames,
  theme,
  onToggleTheme,
  onSignOut,
  onDataReset,
}) => {
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newUserAvatar, setNewUserAvatar] = useState<string | null>(null);
  const [userCreatedMsg, setUserCreatedMsg] = useState<string | null>(null);
  const [userErrorMsg, setUserErrorMsg] = useState<string | null>(null);
  const [avatarNoticeMsg, setAvatarNoticeMsg] = useState<string | null>(null);
  const [copiedPasswordUserId, setCopiedPasswordUserId] = useState<string | null>(null);

  // Church directory names state for autofill management (synced across all devices)
  const [savedNames, setSavedNames] = useState<string[]>(() => propSavedNames || loadSavedNames());

  // Sync internal state when prop changes from Firestore
  React.useEffect(() => {
    if (propSavedNames) {
      setSavedNames(propSavedNames);
    }
  }, [propSavedNames]);

  const [newNameInput, setNewNameInput] = useState('');
  const [importStatus, setImportStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [lyricsImportStatus, setLyricsImportStatus] = useState<{ success: boolean; message: string } | null>(null);

  const isAdmin =
    currentUser.role === 'admin' ||
    currentUser.username.toLowerCase() === DEFAULT_ADMIN.username.toLowerCase();

  const handleAvatarChangeForUser = async (userId: string, file: File) => {
    try {
      const compressed = await compressImageToAvatar(file, 256, 0.85);
      const { updatedUser, allUsers } = updateUserAvatar(userId, compressed);
      onUpdateUsers(allUsers);
      if (updatedUser) {
        syncSaveUser(updatedUser);
      }
      if (userId === currentUser.id && updatedUser) {
        onUpdateCurrentUser(updatedUser);
      }
      setAvatarNoticeMsg('Profile picture updated successfully.');
      setTimeout(() => setAvatarNoticeMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to process image');
    }
  };

  const handleRemoveAvatarForUser = (userId: string) => {
    const { updatedUser, allUsers } = updateUserAvatar(userId, undefined);
    onUpdateUsers(allUsers);
    if (updatedUser) {
      syncSaveUser(updatedUser);
    }
    if (userId === currentUser.id && updatedUser) {
      onUpdateCurrentUser(updatedUser);
    }
    setAvatarNoticeMsg('Profile picture removed.');
    setTimeout(() => setAvatarNoticeMsg(null), 4000);
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setUserCreatedMsg(null);
    setUserErrorMsg(null);

    const cleanUser = newUsername.trim();
    const cleanPass = newPassword.trim();

    if (!cleanUser || !cleanPass) {
      setUserErrorMsg('Please fill in both username and password.');
      return;
    }

    if (users.some((u) => u.username.toLowerCase() === cleanUser.toLowerCase())) {
      setUserErrorMsg(`An account with username "${cleanUser}" already exists.`);
      return;
    }

    const newUser: UserAccount = {
      id: `user-${Date.now()}`,
      username: cleanUser,
      passwordHash: cleanPass,
      role: 'user',
      avatar: newUserAvatar || undefined,
      createdAt: new Date().toISOString(),
    };

    const updated = [...users, newUser];
    saveUsers(updated);
    syncSaveUser(newUser);
    onUpdateUsers(updated);
    setNewUsername('');
    setNewPassword('');
    setNewUserAvatar(null);
    setUserCreatedMsg(`User access successfully created for "${cleanUser}".`);
    setTimeout(() => setUserCreatedMsg(null), 4000);
  };

  const handleDeleteUser = async (userToDelete: UserAccount) => {
    if (userToDelete.username.toLowerCase() === DEFAULT_ADMIN.username.toLowerCase()) {
      alert('The root administrator account cannot be deleted.');
      return;
    }

    if (confirm(`Delete account for user "${userToDelete.username}"?`)) {
      const updated = users.filter(
        (u) =>
          u.id !== userToDelete.id &&
          u.username.toLowerCase() !== userToDelete.username.toLowerCase()
      );
      saveUsers(updated);
      onUpdateUsers(updated);
      await syncDeleteUser(userToDelete.id, userToDelete.username);
      if (expandedUserId === userToDelete.id) {
        setExpandedUserId(null);
      }
    }
  };

  const handleCopyPassword = (userId: string, passwordText: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(passwordText);
      setCopiedPasswordUserId(userId);
      setTimeout(() => setCopiedPasswordUserId(null), 2000);
    }
  };

  const handleNewUserAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageToAvatar(file, 256, 0.85);
      setNewUserAvatar(compressed);
    } catch (err: any) {
      alert(err.message || 'Failed to process image');
    }
    e.target.value = '';
  };

  const handleAddDirectoryName = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newNameInput.trim();
    if (!clean) return;
    if (savedNames.includes(clean)) {
      setNewNameInput('');
      return;
    }
    const updated = [...savedNames, clean].sort((a, b) => a.localeCompare(b));
    saveSavedNames(updated);
    setSavedNames(updated);
    syncSaveSavedNames(updated);
    if (onUpdateSavedNames) onUpdateSavedNames(updated);
    setNewNameInput('');
  };

  const handleDeleteDirectoryName = (nameToDelete: string) => {
    const updated = savedNames.filter((n) => n !== nameToDelete);
    saveSavedNames(updated);
    setSavedNames(updated);
    syncSaveSavedNames(updated);
    if (onUpdateSavedNames) onUpdateSavedNames(updated);
  };

  const handleExportBackup = () => {
    const jsonStr = exportChurchDataJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nlbc_church_music_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const res = importChurchDataJSON(text);
        if (res.success) {
          setImportStatus({ success: true, message: res.message });
          const updatedNames = loadSavedNames();
          setSavedNames(updatedNames);
          syncSaveSavedNames(updatedNames);
          if (onUpdateSavedNames) onUpdateSavedNames(updatedNames);

          // Push restored database to Firestore Cloud for all devices
          loadSongs().forEach(syncSaveSong);
          loadSetlists().forEach(syncSaveSetlist);
          loadBirthdays().forEach(syncSaveBirthday);
          loadAnniversaries().forEach(syncSaveAnniversary);
          loadVisitors().forEach(syncSaveVisitor);
          loadSpecialRecognitions().forEach(syncSaveSpecialRecognition);
          loadSpecialNumbers().forEach(syncSaveSpecialNumber);

          onDataReset();
        } else {
          setImportStatus({ success: false, message: res.message });
        }
      } catch (err: any) {
        setImportStatus({ success: false, message: `Failed to load backup: ${err.message}` });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleBatchLyricsImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const fileList: File[] = Array.from(files);
      const fileReadPromises = fileList.map((file: File) => {
        return new Promise<{ fileName: string; content: string }>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            resolve({
              fileName: file.name,
              content: (event.target?.result as string) || '',
            });
          };
          reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
          reader.readAsText(file);
        });
      });

      const fileContents = await Promise.all(fileReadPromises);
      const result = importBatchLyricsTxt(fileContents);

      // Sync imported songs to Firestore Cloud
      const allCurrentSongs = loadSongs();
      for (const s of allCurrentSongs) {
        syncSaveSong(s);
      }

      setLyricsImportStatus({
        success: true,
        message: `Imported ${fileContents.length} text file(s): ${result.importedCount} new song(s) added, ${result.updatedCount} updated. Library now has ${result.totalSongs} songs.`,
      });
      onDataReset();
    } catch (err: any) {
      setLyricsImportStatus({
        success: false,
        message: `Failed to import lyrics: ${err.message || 'Unknown error'}`,
      });
    }

    e.target.value = '';
  };

  const handleResetData = () => {
    if (
      confirm(
        'Reset all church program data to original default setlists, songs, and recognitions? This will reload the default Quezon, Nueva Ecija church data.'
      )
    ) {
      resetAppToDefaults();
      const updatedNames = loadSavedNames();
      setSavedNames(updatedNames);
      syncSaveSavedNames(updatedNames);
      if (onUpdateSavedNames) onUpdateSavedNames(updatedNames);

      // Sync initial data to Firestore Cloud
      loadSongs().forEach(syncSaveSong);
      loadSetlists().forEach(syncSaveSetlist);
      loadBirthdays().forEach(syncSaveBirthday);
      loadAnniversaries().forEach(syncSaveAnniversary);
      loadVisitors().forEach(syncSaveVisitor);
      loadSpecialRecognitions().forEach(syncSaveSpecialRecognition);
      loadSpecialNumbers().forEach(syncSaveSpecialNumber);

      onDataReset();
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-800 dark:text-slate-200" />
            <span>Settings</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {isAdmin
              ? 'Account profile, user access, directory autofill, and data management'
              : 'Theme appearance and account session settings'}
          </p>
        </div>
      </div>

      {/* Section 1: Current Account Profile & Session */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span>Account Profile & Session</span>
          </h3>
          <button
            onClick={onSignOut}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>

        {avatarNoticeMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-start gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{avatarNoticeMsg}</span>
          </div>
        )}

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Avatar Picture */}
          <div className="relative shrink-0">
            <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-full ring-3 ring-white dark:ring-slate-800 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 flex items-center justify-center font-bold text-xl overflow-hidden shadow-sm">
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
                  if (f) handleAvatarChangeForUser(currentUser.id, f);
                  e.target.value = '';
                }}
              />
            </label>
          </div>

          {/* User Details & Controls */}
          <div className="flex-1 min-w-0 space-y-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-slate-900 dark:text-white">
                  {currentUser.username}
                </span>
                {isAdmin ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
                    Administrator
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    User
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isAdmin
                  ? 'Administrator account with full ministry privileges'
                  : 'Ministry team contributor account'}
              </p>
            </div>

            {/* Profile photo actions */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-white transition-all shadow-2xs">
                <Camera className="w-3.5 h-3.5" />
                <span>{currentUser.avatar ? 'Replace Photo' : 'Upload Profile Picture'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleAvatarChangeForUser(currentUser.id, f);
                    e.target.value = '';
                  }}
                />
              </label>

              {currentUser.avatar && (
                <button
                  type="button"
                  onClick={() => handleRemoveAvatarForUser(currentUser.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-medium border border-rose-200 dark:border-rose-900/60 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Remove Photo</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Appearance & Theme */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
          Appearance & Theme
        </h3>

        <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 shadow-xs">
              {theme === 'dark' ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-sky-600" />}
            </div>
            <div>
              <span className="text-sm font-semibold text-slate-900 dark:text-white block">
                {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {theme === 'dark' ? 'Eye-safe dark theme for sanctuary stage' : 'Crisp high-contrast daylight theme'}
              </span>
            </div>
          </div>

          <button
            onClick={onToggleTheme}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-90 transition-all shadow-xs cursor-pointer"
          >
            Switch to {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
      </div>

      {/* Section 3: User Access & Accounts (Admin Only) */}
      {isAdmin && (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>User Accounts & Permissions ({users.length})</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Click any user to view credentials and manage profile photo.
            </p>
          </div>

          {/* User list */}
          <div className="space-y-2">
            {users.map((u) => {
              const isExpanded = expandedUserId === u.id;
              const isCurrent = u.id === currentUser.id;
              const isRootAdmin = u.username.toLowerCase() === DEFAULT_ADMIN.username.toLowerCase();

              return (
                <div
                  key={u.id}
                  className={`rounded-xl border transition-all ${
                    isExpanded
                      ? 'bg-slate-50 dark:bg-slate-800/80 border-slate-400 dark:border-slate-600 shadow-xs'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div
                    onClick={() => setExpandedUserId(isExpanded ? null : u.id)}
                    className="p-3.5 flex items-center justify-between cursor-pointer select-none"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      {/* User Avatar Circle */}
                      <div className="w-9 h-9 rounded-full ring-2 ring-slate-200 dark:ring-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
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
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {u.username}
                          </span>
                          {u.role === 'admin' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                              Admin
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              User
                            </span>
                          )}
                          {isCurrent && (
                            <span className="text-[10px] text-slate-400 font-normal">
                              (You)
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 block">
                          {isExpanded ? 'Click to collapse' : 'Click to view password & photo options'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform ${
                          isExpanded ? 'rotate-180 text-slate-700 dark:text-slate-200' : ''
                        }`}
                      />
                    </div>
                  </div>

                  {/* Expanded User Credentials & Photo Options */}
                  {isExpanded && (
                    <div className="px-3.5 pb-3.5 pt-2 border-t border-slate-200/70 dark:border-slate-700/70 space-y-3 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center space-x-2">
                          <span className="text-slate-500 dark:text-slate-400 font-medium">
                            Password:
                          </span>
                          <code className="px-2.5 py-1 rounded bg-slate-200 dark:bg-slate-900 font-mono text-slate-900 dark:text-white font-bold text-xs select-all">
                            {u.passwordHash || '(none)'}
                          </code>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyPassword(u.id, u.passwordHash || '');
                            }}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                            title="Copy password"
                          >
                            {copiedPasswordUserId === u.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        {/* Photo options */}
                        <div className="flex items-center gap-2">
                          <label className="cursor-pointer px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-[11px] font-semibold flex items-center gap-1 transition-colors">
                            <Camera className="w-3 h-3" />
                            <span>{u.avatar ? 'Replace Photo' : 'Upload Photo'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleAvatarChangeForUser(u.id, f);
                                e.target.value = '';
                              }}
                            />
                          </label>

                          {u.avatar && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveAvatarForUser(u.id);
                              }}
                              className="px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Clear</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {!isRootAdmin && (
                        <div className="pt-2 border-t border-slate-200/50 dark:border-slate-700/50 flex justify-end">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteUser(u);
                            }}
                            className="px-2.5 py-1 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete User Account</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add New User Form */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add New User Account</span>
            </h4>

            {userCreatedMsg && (
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-start gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 mb-3">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{userCreatedMsg}</span>
              </div>
            )}

            {userErrorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-2 text-xs font-semibold text-rose-800 dark:text-rose-300 mb-3">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{userErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Username *
                  </label>
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Enter username"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              {/* Optional Profile Picture */}
              <div className="flex items-center gap-3 pt-1">
                {newUserAvatar ? (
                  <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-slate-300 dark:ring-slate-600 shrink-0">
                    <img
                      src={newUserAvatar}
                      alt="New user preview"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 flex items-center justify-center shrink-0">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                )}
                <div className="flex-1">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50">
                    <Camera className="w-3.5 h-3.5 text-slate-500" />
                    <span>{newUserAvatar ? 'Change Initial Photo' : 'Add Initial Profile Photo (Optional)'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleNewUserAvatarPick}
                    />
                  </label>
                  {newUserAvatar && (
                    <button
                      type="button"
                      onClick={() => setNewUserAvatar(null)}
                      className="ml-2 text-xs text-rose-500 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs sm:text-sm font-semibold hover:bg-slate-800 dark:hover:bg-white shadow-xs cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Add User</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Section 4: Church Directory & Autofill Suggestions (Admin Only) */}
      {isAdmin && (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                <span>Church Directory & Autofill ({savedNames.length})</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Saved names appear as autocomplete suggestions across Presiders, Song Leaders, and Special Song Numbers.
              </p>
            </div>
          </div>

          {/* Add name input */}
          <form onSubmit={handleAddDirectoryName} className="flex items-center gap-2">
            <input
              type="text"
              value={newNameInput}
              onChange={(e) => setNewNameInput(e.target.value)}
              placeholder="Enter member name..."
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs sm:text-sm font-semibold flex items-center gap-1.5 shrink-0 hover:bg-slate-800 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Name</span>
            </button>
          </form>

          {/* Directory badges */}
          <div className="flex flex-wrap gap-2 pt-2 max-h-48 overflow-y-auto p-1">
            {savedNames.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700"
              >
                <span>{name}</span>
                <button
                  type="button"
                  onClick={() => handleDeleteDirectoryName(name)}
                  className="text-slate-400 hover:text-rose-500 p-0.5 cursor-pointer"
                  title="Remove name"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Section 5: Data Library & Backup Tools (Admin Only) */}
      {isAdmin && (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Database className="w-4 h-4 text-slate-700 dark:text-slate-300" />
              <span>Data Library & Backup Tools</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Export data backups, restore from JSON files, and batch import text lyrics.
            </p>
          </div>

          {/* Batch Lyrics Import */}
          <div className="space-y-3">
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
                    Downloads all setlists, songs library, special numbers, and member directories.
                  </span>
                </div>
              </button>

              <label className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-left hover:border-slate-400 dark:hover:border-slate-500 transition-all flex items-start space-x-3 cursor-pointer shadow-xs">
                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 shrink-0">
                  <Upload className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-bold text-slate-900 dark:text-white block">
                    Load / Import Backup File
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 block">
                    Upload a previously saved JSON backup to restore everything instantly.
                  </span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleImportBackup}
                    className="hidden"
                  />
                </div>
              </label>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleResetData}
              className="text-xs text-slate-400 hover:text-rose-600 flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to default Quezon sample data</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
