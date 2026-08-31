import React, { useState } from 'react';
import { UserAccount } from '../types';
import {
  saveUsers,
  updateUserAvatar,
  DEFAULT_ADMIN,
  DEFAULT_SAVED_NAMES,
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
  saveSongs,
  saveSetlists,
  saveBirthdays,
  saveAnniversaries,
  saveVisitors,
  saveSpecialRecognitions,
  saveSpecialNumbers,
  savePracticeEntries,
  saveChoirEntries,
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
  syncSavePracticeEntry,
  syncSaveChoirEntry,
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
  ChevronUp,
  Camera,
  Image as ImageIcon,
  Copy,
  Check,
  UserCheck,
  Search,
  Key,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Edit2,
  Sparkles,
  Share2,
  X,
  Shield,
  FileSpreadsheet,
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
  appData?: {
    songs: any[];
    setlists: any[];
    specialNumbers: any[];
    practiceEntries: any[];
    choirEntries: any[];
    birthdays: any[];
    anniversaries: any[];
    visitors: any[];
    specialRecognitions: any[];
    savedNames: string[];
    welcomeSongs: string[];
  };
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
  appData,
}) => {
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'user' | 'admin'>('user');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [newUserAvatar, setNewUserAvatar] = useState<string | null>(null);
  const [userCreatedMsg, setUserCreatedMsg] = useState<string | null>(null);
  const [userErrorMsg, setUserErrorMsg] = useState<string | null>(null);
  const [avatarNoticeMsg, setAvatarNoticeMsg] = useState<string | null>(null);
  const [copiedPasswordUserId, setCopiedPasswordUserId] = useState<string | null>(null);
  const [copiedLoginId, setCopiedLoginId] = useState<string | null>(null);
  const [copiedRosterMsg, setCopiedRosterMsg] = useState(false);
  const [showRosterModal, setShowRosterModal] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'admin' | 'user'>('all');
  const [revealedPasswordIds, setRevealedPasswordIds] = useState<Set<string>>(new Set());
  const [isUserDatabaseCollapsed, setIsUserDatabaseCollapsed] = useState(true);

  // Edit user state
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editUserRole, setEditUserRole] = useState<'user' | 'admin'>('user');
  const [showEditPassword, setShowEditPassword] = useState(false);

  // Church directory names state for autofill management (synced across all devices)
  const [savedNames, setSavedNames] = useState<string[]>(() =>
    propSavedNames !== undefined ? propSavedNames : loadSavedNames()
  );

  // Sync internal state when prop changes from Firestore
  React.useEffect(() => {
    if (propSavedNames !== undefined) {
      setSavedNames(propSavedNames);
    }
  }, [propSavedNames]);

  const [newNameInput, setNewNameInput] = useState('');
  const [importStatus, setImportStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [lyricsImportStatus, setLyricsImportStatus] = useState<{ success: boolean; message: string } | null>(null);

  const isAdmin =
    currentUser.role === 'admin' ||
    currentUser.username.toLowerCase() === DEFAULT_ADMIN.username.toLowerCase();

  const generateRandomPassword = () => {
    const prefixes = ['nlbc', 'praise', 'faith', 'grace', 'worship', 'church', 'sing', 'glory'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(100 + Math.random() * 900);
    return `${prefix}${num}`;
  };

  const togglePasswordReveal = (userId: string) => {
    setRevealedPasswordIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

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
      role: newUserRole,
      avatar: newUserAvatar || undefined,
      createdAt: new Date().toISOString(),
    };

    const updated = [...users, newUser];
    saveUsers(updated);
    syncSaveUser(newUser);
    onUpdateUsers(updated);
    setNewUsername('');
    setNewPassword('');
    setNewUserRole('user');
    setNewUserAvatar(null);
    setShowAddUserForm(false);
    setUserCreatedMsg(`User access successfully created for "${cleanUser}".`);
    setTimeout(() => setUserCreatedMsg(null), 4000);
  };

  const handleStartEditUser = (user: UserAccount) => {
    setEditingUser(user);
    setEditUsername(user.username);
    setEditPassword(user.passwordHash || '');
    setEditUserRole(user.role || 'user');
    setShowEditPassword(false);
  };

  const handleSaveEditUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    const cleanUser = editUsername.trim();
    const cleanPass = editPassword.trim();

    if (!cleanUser || !cleanPass) {
      alert('Please fill in both username and password.');
      return;
    }

    const duplicate = users.find(
      (u) => u.id !== editingUser.id && u.username.toLowerCase() === cleanUser.toLowerCase()
    );
    if (duplicate) {
      alert(`An account with username "${cleanUser}" already exists.`);
      return;
    }

    const isRootAdmin = editingUser.username.toLowerCase() === DEFAULT_ADMIN.username.toLowerCase();
    const updatedUser: UserAccount = {
      ...editingUser,
      username: cleanUser,
      passwordHash: cleanPass,
      role: isRootAdmin ? 'admin' : editUserRole,
    };

    const updatedList = users.map((u) => (u.id === editingUser.id ? updatedUser : u));
    saveUsers(updatedList);
    onUpdateUsers(updatedList);
    syncSaveUser(updatedUser);
    if (currentUser.id === editingUser.id) {
      onUpdateCurrentUser(updatedUser);
    }
    setEditingUser(null);
    setUserCreatedMsg(`Credentials updated for "${cleanUser}".`);
    setTimeout(() => setUserCreatedMsg(null), 4000);
  };

  const handleDeleteUser = async (userToDelete: UserAccount) => {
    if (userToDelete.username.toLowerCase() === DEFAULT_ADMIN.username.toLowerCase()) {
      alert('The root administrator account cannot be deleted.');
      return;
    }

    if (confirm(`Delete account for user "${userToDelete.username}" from the User Database?`)) {
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
      if (editingUser?.id === userToDelete.id) {
        setEditingUser(null);
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

  const handleCopyLoginInfo = (u: UserAccount) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const text = `New Life Baptist Church Ministry App Access\nUsername: ${u.username}\nPassword: ${u.passwordHash || ''}\nRole: ${u.role === 'admin' ? 'Administrator' : 'Member / User'}\nApp Link: ${origin}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedLoginId(u.id);
      setTimeout(() => setCopiedLoginId(null), 2500);
    }
  };

  const handleCopyAllCredentials = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const lines = users.map(
      (u, idx) =>
        `${idx + 1}. Username: ${u.username} | Password: ${u.passwordHash || ''} | Role: ${u.role === 'admin' ? 'Admin' : 'Member'}`
    );
    const text = `NLBC User Database Credentials Roster (${users.length} Accounts)\n=======================================================\n${lines.join('\n')}\n\nApp Link: ${origin}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedRosterMsg(true);
      setTimeout(() => setCopiedRosterMsg(false), 2500);
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

  const handleClearAllDirectoryNames = () => {
    if (
      confirm(
        'Delete all names from the Church Directory? Autocomplete suggestions will be immediately cleared across all devices.'
      )
    ) {
      const updated: string[] = [];
      saveSavedNames(updated);
      setSavedNames(updated);
      syncSaveSavedNames(updated);
      if (onUpdateSavedNames) onUpdateSavedNames(updated);
    }
  };

  const handleResetDefaultDirectoryNames = () => {
    if (
      confirm(
        'Reset Church Directory back to the default list of names? This will sync to all connected devices.'
      )
    ) {
      const updated = [...DEFAULT_SAVED_NAMES];
      saveSavedNames(updated);
      setSavedNames(updated);
      syncSaveSavedNames(updated);
      if (onUpdateSavedNames) onUpdateSavedNames(updated);
    }
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

      {/* Section 3: User Database & Access Control (Admin Only) */}
      {isAdmin && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all">
          {/* Collapsible Header */}
          <div
            onClick={() => setIsUserDatabaseCollapsed(!isUserDatabaseCollapsed)}
            className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none group hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs shrink-0">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>User Database & Access Control</span>
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    {users.length} {users.length === 1 ? 'Account' : 'Accounts'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {isUserDatabaseCollapsed
                    ? 'Tap to view and manage user accounts in the credentials sheet.'
                    : 'All created user accounts are organized in the sheet below.'}
                </p>
              </div>
            </div>

            {/* Quick Action Buttons on Header */}
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyAllCredentials();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors cursor-pointer"
                title="Copy all usernames & passwords to clipboard"
              >
                {copiedRosterMsg ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedRosterMsg ? 'Roster Copied!' : 'Copy Roster'}</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAddUserForm(!showAddUserForm);
                  if (isUserDatabaseCollapsed) {
                    setIsUserDatabaseCollapsed(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-white transition-all shadow-xs cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{showAddUserForm && !isUserDatabaseCollapsed ? 'Close Form' : 'Add User'}</span>
              </button>

              <div
                className="p-1.5 rounded-xl text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 group-hover:bg-slate-200/60 dark:group-hover:bg-slate-700/60 transition-all"
                title={isUserDatabaseCollapsed ? 'Expand credentials sheet' : 'Collapse sheet'}
              >
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${
                    isUserDatabaseCollapsed ? '' : 'rotate-180'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Collapsible Sheet Body */}
          {!isUserDatabaseCollapsed && (
            <div className="p-4 sm:p-5 pt-0 space-y-4 border-t border-slate-100 dark:border-slate-800">
              {/* Feedback messages */}
              {userCreatedMsg && (
                <div className="mt-4 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-start gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{userCreatedMsg}</span>
                </div>
              )}

              {userErrorMsg && (
                <div className="mt-4 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-2 text-xs font-semibold text-rose-800 dark:text-rose-300">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{userErrorMsg}</span>
                </div>
              )}

              {/* Add New User Collapsible Form */}
              {showAddUserForm && (
                <div className="mt-4 p-4 sm:p-5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-300 dark:border-slate-700 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      <UserPlus className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                      <span>Add New User Account</span>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Auto-adds to credentials sheet
                    </span>
                  </div>

                  <form onSubmit={handleCreateUser} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {/* Username Field */}
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                          Username *
                        </label>
                        <input
                          type="text"
                          required
                          autoFocus
                          value={newUsername}
                          onChange={(e) => setNewUsername(e.target.value)}
                          placeholder="e.g. Bro. Juan, Sis. Maria, pianist01"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-100"
                        />
                      </div>

                      {/* Password Field */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                            Password *
                          </label>
                          <button
                            type="button"
                            onClick={() => setNewPassword(generateRandomPassword())}
                            className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-1 font-medium cursor-pointer"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>Generate Password</span>
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type={showNewPassword ? 'text' : 'password'}
                            required
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Enter password"
                            className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-100 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                            title={showNewPassword ? 'Hide password' : 'Show password'}
                          >
                            {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                      {/* Role Selection */}
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                          Access Role
                        </label>
                        <select
                          value={newUserRole}
                          onChange={(e) => setNewUserRole(e.target.value as 'user' | 'admin')}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-100 cursor-pointer"
                        >
                          <option value="user">Standard User (Songs, Setlists, Special Numbers, Choir)</option>
                          <option value="admin">Administrator (Full settings & database control)</option>
                        </select>
                      </div>

                      {/* Optional Avatar */}
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                          Profile Photo (Optional)
                        </label>
                        <div className="flex items-center gap-3">
                          {newUserAvatar ? (
                            <div className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-slate-300 dark:ring-slate-600 shrink-0">
                              <img
                                src={newUserAvatar}
                                alt="New user preview"
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 flex items-center justify-center shrink-0">
                              <ImageIcon className="w-4 h-4" />
                            </div>
                          )}
                          <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                            <Camera className="w-3.5 h-3.5 text-slate-500" />
                            <span>{newUserAvatar ? 'Change Photo' : 'Upload Photo'}</span>
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
                              className="text-xs text-rose-500 hover:underline cursor-pointer"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => setShowAddUserForm(false)}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs sm:text-sm font-semibold hover:bg-slate-800 dark:hover:bg-white shadow-xs transition-all cursor-pointer"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>Save to Sheet</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Search and Role Filter Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="Search user database by username..."
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-100"
                  />
                  {userSearchQuery && (
                    <button
                      onClick={() => setUserSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
                  <button
                    type="button"
                    onClick={() => setUserRoleFilter('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      userRoleFilter === 'all'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    All ({users.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserRoleFilter('admin')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      userRoleFilter === 'admin'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Admins ({users.filter((u) => u.role === 'admin').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserRoleFilter('user')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      userRoleFilter === 'user'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Users ({users.filter((u) => u.role !== 'admin').length})
                  </button>
                </div>
              </div>

              {/* Collapsible Interactive Credentials Sheet Table */}
              <div className="border border-slate-200 dark:border-slate-700/80 rounded-xl overflow-hidden shadow-2xs bg-white dark:bg-slate-900">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-3 w-10 text-center text-slate-400">#</th>
                        <th className="p-3">User / Member</th>
                        <th className="p-3">Password</th>
                        <th className="p-3">Role</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {users
                        .filter((u) => {
                          const matchesSearch =
                            u.username.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                            (u.passwordHash && u.passwordHash.toLowerCase().includes(userSearchQuery.toLowerCase()));
                          const matchesRole =
                            userRoleFilter === 'all'
                              ? true
                              : userRoleFilter === 'admin'
                              ? u.role === 'admin'
                              : u.role !== 'admin';
                          return matchesSearch && matchesRole;
                        })
                        .map((u, idx) => {
                          const isCurrent = u.id === currentUser.id;
                          const isRootAdmin = u.username.toLowerCase() === DEFAULT_ADMIN.username.toLowerCase();
                          const isPasswordRevealed = revealedPasswordIds.has(u.id);

                          return (
                            <tr
                              key={u.id}
                              className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                            >
                              {/* # Index */}
                              <td className="p-3 text-center text-slate-400 font-mono text-[11px]">
                                {idx + 1}
                              </td>

                              {/* User with avatar */}
                              <td className="p-3">
                                <div className="flex items-center gap-2.5 min-w-[150px]">
                                  <div className="relative shrink-0">
                                    <div className="w-8 h-8 rounded-full ring-1 ring-slate-200 dark:ring-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center justify-center font-bold text-[11px] overflow-hidden">
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
                                    <label
                                      className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 flex items-center justify-center cursor-pointer opacity-80 hover:opacity-100"
                                      title="Change photo"
                                    >
                                      <Camera className="w-2 h-2" />
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
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-bold text-slate-900 dark:text-white truncate">
                                        {u.username}
                                      </span>
                                      {isCurrent && (
                                        <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400">
                                          (You)
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Password with 1-click reveal & copy */}
                              <td className="p-3">
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                                  <Key className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-[11px] min-w-[70px]">
                                    {isPasswordRevealed ? u.passwordHash || '(none)' : '••••••••'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => togglePasswordReveal(u.id)}
                                    className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                                    title={isPasswordRevealed ? 'Hide password' : 'Show password'}
                                  >
                                    {isPasswordRevealed ? (
                                      <EyeOff className="w-3 h-3" />
                                    ) : (
                                      <Eye className="w-3 h-3" />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyPassword(u.id, u.passwordHash || '')}
                                    className="p-0.5 text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                                    title="Copy password"
                                  >
                                    {copiedPasswordUserId === u.id ? (
                                      <Check className="w-3 h-3 text-emerald-500" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                              </td>

                              {/* Role */}
                              <td className="p-3">
                                {u.role === 'admin' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                                    <Shield className="w-2.5 h-2.5" />
                                    <span>Administrator</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                    User / Member
                                  </span>
                                )}
                              </td>

                              {/* Actions */}
                              <td className="p-3 text-right">
                                <div className="inline-flex items-center gap-1 justify-end">
                                  <button
                                    type="button"
                                    onClick={() => handleCopyLoginInfo(u)}
                                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                                    title="Share login invite"
                                  >
                                    {copiedLoginId === u.id ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    ) : (
                                      <Share2 className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditUser(u)}
                                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                                    title="Edit user credentials"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  {!isRootAdmin && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteUser(u)}
                                      className="p-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 transition-colors cursor-pointer"
                                      title="Delete user"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>

                {users.length === 0 && (
                  <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    No user accounts created yet. Click &quot;Add User&quot; to add member credentials.
                  </div>
                )}
              </div>

              {/* Sheet Bottom Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                <span>
                  Showing {users.length} {users.length === 1 ? 'member account' : 'member accounts'} synced across all devices.
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyAllCredentials}
                    className="text-xs font-semibold text-slate-900 dark:text-white hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy Full Roster</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Edit User Credentials
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Update username or password for this account
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Username *
                </label>
                <input
                  type="text"
                  required
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-100"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Password *
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditPassword(generateRandomPassword())}
                    className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-1 font-medium cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Generate Easy Password</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showEditPassword ? 'text' : 'password'}
                    required
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-100 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {editingUser.username.toLowerCase() !== DEFAULT_ADMIN.username.toLowerCase() && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Access Role
                  </label>
                  <select
                    value={editUserRole}
                    onChange={(e) => setEditUserRole(e.target.value as 'user' | 'admin')}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-100 cursor-pointer"
                  >
                    <option value="user">Standard User (Songs, Setlists, Special Numbers, Choir)</option>
                    <option value="admin">Administrator (Full settings & database control)</option>
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-white shadow-xs cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full Credentials Roster Modal */}
      {showRosterModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    User Database Credentials Sheet
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Complete list of all usernames and passwords ({users.length} accounts)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRosterModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-2.5">#</th>
                      <th className="p-2.5">Username</th>
                      <th className="p-2.5">Password</th>
                      <th className="p-2.5">Role</th>
                      <th className="p-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {users.map((u, idx) => (
                      <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="p-2.5 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-2.5 font-semibold text-slate-900 dark:text-white">
                          {u.username}
                        </td>
                        <td className="p-2.5 font-mono text-slate-800 dark:text-slate-200 font-bold select-all">
                          {u.passwordHash}
                        </td>
                        <td className="p-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              u.role === 'admin'
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="p-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleCopyLoginInfo(u)}
                            className="p-1 rounded text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                            title="Copy login invite"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[11px] text-slate-400">
                Synchronized across all devices via Firestore Cloud
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyAllCredentials}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-white cursor-pointer shadow-xs"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Entire Roster</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowRosterModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section 4: Church Directory & Autofill Suggestions (Admin Only) */}
      {isAdmin && (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                <span>Church Directory & Autofill ({savedNames.length})</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Saved names appear as autocomplete suggestions across Presiders, Song Leaders, and Special Song Numbers.
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
              <button
                type="button"
                onClick={handleResetDefaultDirectoryNames}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Restore default starter list of ministry names"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Defaults</span>
              </button>
              {savedNames.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllDirectoryNames}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="Clear all autofill directory names"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All</span>
                </button>
              )}
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
          {savedNames.length > 0 ? (
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
                    className="text-slate-400 hover:text-rose-500 p-0.5 cursor-pointer transition-colors"
                    title={`Remove ${name}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 space-y-1">
              <p className="font-semibold text-slate-600 dark:text-slate-300">Church directory is empty (0 names)</p>
              <p>Autocomplete suggestions for leaders, presiders, and special numbers are cleared across all devices. Add members above when ready.</p>
            </div>
          )}
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
