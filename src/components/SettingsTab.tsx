import React, { useState, useMemo } from 'react';
import { UserAccount } from '../types';
import {
  saveUsers,
  updateUserAvatar,
  DEFAULT_ADMIN,
  deleteAllNonAdminUsers,
  resetAppToDefaults,
  clearAllLocalDataToZero,
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
  syncDeleteAllNonAdminUsers,
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
  wipeAllChurchDataToZero,
  pushAllLocalDataToFirestore,
  syncBatchImportToFirestore,
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
  Check,
  UserCheck,
  Search,
  Key,
  Eye,
  EyeOff,
  Edit2,
  Sparkles,
  Share2,
  X,
  Shield,
  Cloud,
  CloudOff,
  Clock,
  Radio,
  ExternalLink,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

import { FirestoreStatusInfo, CollectionSyncLogEntry } from '../firestoreSync';
import firebaseConfig from '../../firebase-applet-config.json';

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
  firestoreStatus?: FirestoreStatusInfo;
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
  savedNames: propSavedNames,
  onUpdateSavedNames,
  theme,
  onToggleTheme,
  onSignOut,
  onDataReset,
  firestoreStatus,
  onOpenFirestoreStatusModal,
  appData,
}) => {
  // Collapsible container states for all sections (collapsed by default)
  const [isAccountCollapsed, setIsAccountCollapsed] = useState(true);
  const [isAppearanceCollapsed, setIsAppearanceCollapsed] = useState(true);
  const [isUserDatabaseCollapsed, setIsUserDatabaseCollapsed] = useState(true);
  const [isChurchDirectoryCollapsed, setIsChurchDirectoryCollapsed] = useState(true);
  const [isDataBackupCollapsed, setIsDataBackupCollapsed] = useState(true);
  const [isSyncLogsCollapsed, setIsSyncLogsCollapsed] = useState(false);

  // New user form state
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'user' | 'admin'>('user');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [newUserAvatar, setNewUserAvatar] = useState<string | null>(null);
  const [userCreatedMsg, setUserCreatedMsg] = useState<string | null>(null);
  const [userErrorMsg, setUserErrorMsg] = useState<string | null>(null);
  const [avatarNoticeMsg, setAvatarNoticeMsg] = useState<string | null>(null);

  // Single copy/share feedback state
  const [copiedLoginId, setCopiedLoginId] = useState<string | null>(null);

  // User database filtering and controls
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'admin' | 'user'>('all');
  const [revealedPasswordIds, setRevealedPasswordIds] = useState<Set<string>>(new Set());

  // Edit user modal state
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

  // Ensure Admin is always included in the user database list
  const displayUsers = useMemo(() => {
    const list = [...users];
    if (!list.some((u) => u.username.toLowerCase() === DEFAULT_ADMIN.username.toLowerCase())) {
      list.unshift(DEFAULT_ADMIN);
    }
    return list;
  }, [users]);

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

    if (displayUsers.some((u) => u.username.toLowerCase() === cleanUser.toLowerCase())) {
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

    const updated = [...displayUsers, newUser];
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

    const duplicate = displayUsers.find(
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

    const updatedList = displayUsers.map((u) => (u.id === editingUser.id ? updatedUser : u));
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
      const updated = displayUsers.filter(
        (u) =>
          u.id !== userToDelete.id &&
          u.username.toLowerCase() !== userToDelete.username.toLowerCase()
      );
      saveUsers(updated);
      onUpdateUsers(updated);
      await syncDeleteUser(userToDelete.id, userToDelete.username);
      if (editingUser?.id === userToDelete.id) {
        setEditingUser(null);
      }
    }
  };

  const handleDeleteAllNonAdminUsers = async () => {
    const nonAdminCount = displayUsers.filter(
      (u) =>
        u.role !== 'admin' &&
        u.username.toLowerCase() !== DEFAULT_ADMIN.username.toLowerCase()
    ).length;

    if (nonAdminCount === 0) {
      alert('Only the root Admin account exists. There are no regular user accounts to delete.');
      return;
    }

    if (
      confirm(
        `Are you sure you want to delete ALL (${nonAdminCount}) regular user accounts and revoke their access? The Admin account will be the only one remaining.`
      )
    ) {
      const remaining = deleteAllNonAdminUsers();
      saveUsers(remaining);
      onUpdateUsers(remaining);
      await syncDeleteAllNonAdminUsers();
      setUserCreatedMsg('All non-admin user accounts and accesses have been permanently deleted.');
      setTimeout(() => setUserCreatedMsg(null), 5000);
    }
  };

  // Standardized Single Copy/Share Access Function
  const handleCopyUserAccess = (u: UserAccount) => {
    const text = `QNLBC APP Worship Team Access\nUsername: ${u.username}\nPassword: ${u.passwordHash || ''}\nApp Link: https://moaedigitals.github.io/QNLBC-APP/`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedLoginId(u.id);
      setTimeout(() => setCopiedLoginId(null), 2500);
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

  // Church Directory & Autofill Handlers
  const handleAddDirectoryName = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newNameInput.trim();
    if (!clean) return;
    if (savedNames.some((n) => n.toLowerCase() === clean.toLowerCase())) {
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

  const handleExportBackup = () => {
    const jsonStr = exportChurchDataJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qnlbc_church_music_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const [isImporting, setIsImporting] = useState(false);
  const [isPushingCloud, setIsPushingCloud] = useState(false);
  const [cloudPushStatus, setCloudPushStatus] = useState<{ success: boolean; message: string } | null>(null);

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportStatus({ success: true, message: 'Reading and validating backup file...' });

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const res = importChurchDataJSON(text);
        if (res.success) {
          setImportStatus({
            success: true,
            message: 'Importing locally and synchronizing all data to Firestore Cloud for all mobile devices...',
          });

          const updatedNames = loadSavedNames();
          setSavedNames(updatedNames);
          if (onUpdateSavedNames) onUpdateSavedNames(updatedNames);

          // Push restored database to Firestore Cloud using high-performance chunked batches
          const cloudRes = await syncBatchImportToFirestore();

          if (cloudRes.success) {
            setImportStatus({
              success: true,
              message: `${res.message} ${cloudRes.message}`,
            });
          } else {
            setImportStatus({
              success: true,
              message: `${res.message} (Local restore succeeded, background sync queued)`,
            });
          }

          onDataReset();
        } else {
          setImportStatus({ success: false, message: res.message });
        }
      } catch (err: any) {
        setImportStatus({ success: false, message: 'Invalid JSON file: ' + err.message });
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handlePushAllToCloud = async () => {
    setIsPushingCloud(true);
    setCloudPushStatus(null);
    try {
      const res = await pushAllLocalDataToFirestore();
      setCloudPushStatus({ success: res.success, message: res.message });
      onDataReset();
    } catch (err: any) {
      setCloudPushStatus({
        success: false,
        message: `Cloud sync error: ${err.message || 'Unable to connect to cloud'}`,
      });
    } finally {
      setIsPushingCloud(false);
    }
  };

  const handleBatchLyricsImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const res = await importBatchLyricsTxt(files);
      const msg = `Successfully processed ${files.length} file(s): added ${res.importedCount} new song(s), updated ${res.updatedCount} existing song(s). Total songs in library: ${res.totalSongs}.`;
      setLyricsImportStatus({ success: true, message: msg });
      const updatedSongs = loadSongs();
      updatedSongs.forEach((s) => syncSaveSong(s));
      onDataReset();
    } catch (err: any) {
      setLyricsImportStatus({ success: false, message: 'Failed to process files: ' + err.message });
    }
    e.target.value = '';
  };

  const [isWiping, setIsWiping] = useState(false);

  const handleResetData = async () => {
    const confirmation = prompt(
      'Type RESET to permanently wipe all saved songs, setlists, birthdays, anniversaries, special numbers, choir and practice entries across ALL connected devices and the cloud database back to 0:'
    );
    if (confirmation === 'RESET' || confirmation === 'reset') {
      setIsWiping(true);
      try {
        await wipeAllChurchDataToZero(currentUser?.username || 'admin');
        clearAllLocalDataToZero();
        setSavedNames([]);
        if (onUpdateSavedNames) onUpdateSavedNames([]);
        onDataReset();
        alert('All church data has been successfully reset back to 0 across all devices and the cloud database.');
      } catch (err: any) {
        alert('Error resetting data: ' + (err.message || 'Unknown error'));
      } finally {
        setIsWiping(false);
      }
    }
  };

  // Filtered users for table rendering
  const filteredUsers = useMemo(() => {
    return displayUsers.filter((u) => {
      const matchesSearch =
        u.username.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        (u.passwordHash && u.passwordHash.toLowerCase().includes(userSearchQuery.toLowerCase()));
      const matchesRole =
        userRoleFilter === 'all'
          ? true
          : userRoleFilter === 'admin'
          ? u.role === 'admin' || u.username.toLowerCase() === DEFAULT_ADMIN.username.toLowerCase()
          : u.role !== 'admin' && u.username.toLowerCase() !== DEFAULT_ADMIN.username.toLowerCase();
      return matchesSearch && matchesRole;
    });
  }, [displayUsers, userSearchQuery, userRoleFilter]);

  return (
    <div className="space-y-5 max-w-3xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-800 dark:text-slate-200" />
            <span>Settings</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {isAdmin
              ? 'Account profile, user access, church directory autofill, and data management'
              : 'Theme appearance and account session settings'}
          </p>
        </div>
      </div>

      {/* Container 1: Current Account Profile & Session */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all">
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
                Logged in as <span className="font-semibold text-slate-700 dark:text-slate-300">{currentUser.username}</span> ({currentUser.role === 'admin' ? 'Administrator' : 'Worship Team Member'})
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

              {/* User details */}
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                    {currentUser.username}
                  </span>
                  {isAdmin ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                      <ShieldCheck className="w-3 h-3" />
                      <span>Administrator</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      Worship Team Member
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Profile photos and account changes sync seamlessly to all your active devices.
                </p>

                <div className="pt-2 flex items-center gap-2 flex-wrap">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer shadow-2xs">
                    <Camera className="w-3.5 h-3.5" />
                    <span>{currentUser.avatar ? 'Change Photo' : 'Upload Photo'}</span>
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
        )}
      </div>

      {/* Container 2: Appearance & Theme */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all">
        <div
          onClick={() => setIsAppearanceCollapsed(!isAppearanceCollapsed)}
          className="p-4 sm:p-5 flex items-center justify-between gap-3 cursor-pointer select-none group hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900 shrink-0">
              {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Appearance & Theme</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Current theme: <span className="font-semibold text-slate-700 dark:text-slate-300">{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
              </p>
            </div>
          </div>

          <div className="p-1 rounded-lg text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-all">
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isAppearanceCollapsed ? '' : 'rotate-180'}`} />
          </div>
        </div>

        {!isAppearanceCollapsed && (
          <div className="p-4 sm:p-5 pt-0 space-y-4 border-t border-slate-100 dark:border-slate-800">
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
                type="button"
                onClick={onToggleTheme}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-90 transition-all shadow-xs cursor-pointer"
              >
                Switch to {theme === 'dark' ? 'Light' : 'Dark'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Container 3: User Database & Access Control (Admin Only) */}
      {isAdmin && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all">
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
                    {displayUsers.length} {displayUsers.length === 1 ? 'Account' : 'Accounts'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Manage accounts, grant roles, and share direct login credentials.
                </p>
              </div>
            </div>

            {/* Quick Action Buttons on Header */}
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
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
              <div className="p-1 rounded-lg text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-all">
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isUserDatabaseCollapsed ? '' : 'rotate-180'}`} />
              </div>
            </div>
          </div>

          {!isUserDatabaseCollapsed && (
            <div className="p-4 sm:p-5 pt-0 space-y-4 border-t border-slate-100 dark:border-slate-800">
              {/* Feedback messages */}
              {userCreatedMsg && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-start gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{userCreatedMsg}</span>
                </div>
              )}
              {userErrorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-2 text-xs font-semibold text-rose-800 dark:text-rose-300">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{userErrorMsg}</span>
                </div>
              )}

              {/* Add User Collapsible Form */}
              {showAddUserForm && (
                <form
                  onSubmit={handleCreateUser}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3.5 shadow-2xs"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Create New User Access</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddUserForm(false)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Username */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Username / Member Name *
                      </label>
                      <input
                        type="text"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="e.g. John Santos"
                        required
                        className="w-full px-3 py-2 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
                      />
                    </div>

                    {/* Password */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Password *
                        </label>
                        <button
                          type="button"
                          onClick={() => setNewPassword(generateRandomPassword())}
                          className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Sparkles className="w-2.5 h-2.5" />
                          <span>Generate</span>
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Secret password"
                          required
                          className="w-full px-3 py-2 pr-8 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        >
                          {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* Role */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        System Role
                      </label>
                      <select
                        value={newUserRole}
                        onChange={(e) => setNewUserRole(e.target.value as 'user' | 'admin')}
                        className="w-full px-3 py-2 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                      >
                        <option value="user">User / Worship Team Member</option>
                        <option value="admin">Administrator (Full Access)</option>
                      </select>
                    </div>

                    {/* Avatar Upload (Optional) */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Member Profile Photo (Optional)
                      </label>
                      <div className="flex items-center gap-2">
                        {newUserAvatar && (
                          <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 ring-1 ring-slate-300 dark:ring-slate-700">
                            <img src={newUserAvatar} alt="New user" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 cursor-pointer">
                          <Camera className="w-3 h-3" />
                          <span>{newUserAvatar ? 'Change Photo' : 'Select Photo'}</span>
                          <input type="file" accept="image/*" onChange={handleNewUserAvatarPick} className="hidden" />
                        </label>
                        {newUserAvatar && (
                          <button
                            type="button"
                            onClick={() => setNewUserAvatar(null)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setShowAddUserForm(false)}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-90 transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Save Member Access</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Search & Filter Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="Search accounts by username..."
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
                    All ({displayUsers.length})
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
                    Admins ({displayUsers.filter((u) => u.role === 'admin' || u.username.toLowerCase() === DEFAULT_ADMIN.username.toLowerCase()).length})
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
                    Users ({displayUsers.filter((u) => u.role !== 'admin' && u.username.toLowerCase() !== DEFAULT_ADMIN.username.toLowerCase()).length})
                  </button>
                </div>

                {displayUsers.some(
                  (u) =>
                    u.role !== 'admin' &&
                    u.username.toLowerCase() !== DEFAULT_ADMIN.username.toLowerCase()
                ) && (
                  <button
                    type="button"
                    onClick={handleDeleteAllNonAdminUsers}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/60 text-xs font-bold transition-colors cursor-pointer shrink-0"
                    title="Delete all user accounts except Admin"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                    <span>Delete All Users (Keep Admin Only)</span>
                  </button>
                )}
              </div>

              {/* Interactive Credentials Sheet Table */}
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
                      {filteredUsers.map((u, idx) => {
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

                            {/* Password with 1-click reveal */}
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
                                    <EyeOff className="w-3.5 h-3.5" />
                                  ) : (
                                    <Eye className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </td>

                            {/* Role */}
                            <td className="p-3">
                              {u.role === 'admin' || isRootAdmin ? (
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

                            {/* Single Copy/Share Access Button + Actions */}
                            <td className="p-3 text-right">
                              <div className="inline-flex items-center gap-1.5 justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleCopyUserAccess(u)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                                  title="Copy access credentials to clipboard"
                                >
                                  {copiedLoginId === u.id ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400">Copied!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Share2 className="w-3.5 h-3.5" />
                                      <span className="text-[11px]">Copy / Share</span>
                                    </>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleStartEditUser(u)}
                                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                                  title="Edit credentials"
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

                {filteredUsers.length === 0 && (
                  <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    No matching user accounts found. Click &quot;Add User&quot; to add member credentials.
                  </div>
                )}
              </div>

              {/* Sheet Bottom Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                <span>
                  Showing {displayUsers.length} {displayUsers.length === 1 ? 'member account' : 'member accounts'} synced across all devices.
                </span>
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
                <Edit2 className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Edit Credentials for &quot;{editingUser.username}&quot;
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditUser} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Username / Member Name
                </label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditPassword(generateRandomPassword())}
                    className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>Generate</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showEditPassword ? 'text' : 'password'}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2 pr-8 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showEditPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {editingUser.username.toLowerCase() !== DEFAULT_ADMIN.username.toLowerCase() && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    System Role
                  </label>
                  <select
                    value={editUserRole}
                    onChange={(e) => setEditUserRole(e.target.value as 'user' | 'admin')}
                    className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="user">User / Worship Team Member</option>
                    <option value="admin">Administrator (Full Access)</option>
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-90 cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Container 4: Church Directory & Autofill Suggestions (Admin Only) */}
      {isAdmin && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all">
          <div
            onClick={() => setIsChurchDirectoryCollapsed(!isChurchDirectoryCollapsed)}
            className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none group hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-900 shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Church Directory & Autofill</span>
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    {savedNames.length} {savedNames.length === 1 ? 'Name' : 'Names'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Saved names auto-populate across Presiders, Song Leaders, and Special Numbers.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              {savedNames.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClearAllDirectoryNames();
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="Clear all autofill directory names"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All</span>
                </button>
              )}
              <div className="p-1 rounded-lg text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-all">
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isChurchDirectoryCollapsed ? '' : 'rotate-180'}`} />
              </div>
            </div>
          </div>

          {!isChurchDirectoryCollapsed && (
            <div className="p-4 sm:p-5 pt-0 space-y-4 border-t border-slate-100 dark:border-slate-800">
              {/* Add name input form */}
              <form onSubmit={handleAddDirectoryName} className="flex items-center gap-2">
                <input
                  type="text"
                  value={newNameInput}
                  onChange={(e) => setNewNameInput(e.target.value)}
                  placeholder="Enter church member name (e.g. Bro. Juan Dela Cruz)..."
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs sm:text-sm font-semibold flex items-center gap-1.5 shrink-0 hover:bg-slate-800 cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Name</span>
                </button>
              </form>

              {/* Directory badges */}
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
                <div className="p-4 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                  <p className="font-semibold text-slate-600 dark:text-slate-300">Church directory is ready for entries</p>
                  <p>Type member names above and click &quot;Add Name&quot;. They will immediately appear as autofill options across all devices.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Container 5: Data Library & Backup Tools (Admin Only) */}
      {isAdmin && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all">
          <div
            onClick={() => setIsDataBackupCollapsed(!isDataBackupCollapsed)}
            className="p-4 sm:p-5 flex items-center justify-between gap-3 cursor-pointer select-none group hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 shrink-0">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Data Library & Backup Tools</span>
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

                {cloudPushStatus && (
                  <div
                    className={`p-3.5 rounded-xl border flex items-start gap-2 text-xs font-semibold ${
                      cloudPushStatus.success
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                        : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300'
                    }`}
                  >
                    {cloudPushStatus.success ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <span>{cloudPushStatus.message}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
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
                        Download full JSON backup of songs, setlists, and directories.
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
                        {isImporting ? 'Restoring & Syncing...' : 'Load / Import Backup File'}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 block">
                        Upload JSON backup to restore and sync across all mobile devices.
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

                  <button
                    type="button"
                    disabled={isPushingCloud}
                    onClick={handlePushAllToCloud}
                    className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-left hover:border-sky-400 dark:hover:border-sky-500 transition-all flex items-start space-x-3 cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 shrink-0">
                      <Cloud className={`w-5 h-5 text-sky-600 ${isPushingCloud ? 'animate-pulse' : ''}`} />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-bold text-slate-900 dark:text-white block">
                        {isPushingCloud ? 'Pushing to Cloud...' : 'Force Sync to Mobile Devices'}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 block">
                        Directly re-uploads all local songs and setlists to Firestore Cloud.
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="p-4 rounded-xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h5 className="text-sm font-bold text-rose-900 dark:text-rose-300 flex items-center gap-1.5">
                      <RotateCcw className="w-4 h-4 text-rose-600" />
                      <span>Global Reset (Back to 0)</span>
                    </h5>
                    <p className="text-xs text-rose-700/80 dark:text-rose-400 mt-0.5">
                      Permanently wipes all songs, setlists, birthdays, and registrations to 0 across all phones, tablets, and computers.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isWiping}
                    onClick={handleResetData}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs shadow-sm cursor-pointer transition-colors shrink-0 flex items-center gap-1.5"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${isWiping ? 'animate-spin' : ''}`} />
                    <span>{isWiping ? 'Wiping Database...' : 'Wipe Everything to 0'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Container 6: Firestore Cloud Sync & Real-time Logs */}
      {firestoreStatus && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all">
          <div
            onClick={() => setIsSyncLogsCollapsed(!isSyncLogsCollapsed)}
            className="p-4 sm:p-5 flex items-center justify-between gap-3 cursor-pointer select-none group hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900 shrink-0">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    Cloud Sync Status & Server Logs
                  </h3>
                  {firestoreStatus.status === 'online' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live Stream
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Last successful sync timestamps for all collections and cloud databases.
                </p>
              </div>
            </div>

            <div className="p-1 rounded-lg text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-all">
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-200 ${
                  isSyncLogsCollapsed ? '' : 'rotate-180'
                }`}
              />
            </div>
          </div>

          {!isSyncLogsCollapsed && (
            <div className="p-4 sm:p-5 pt-0 space-y-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Real-time listeners updated automatically as data changes.</span>
                </div>

                {onOpenFirestoreStatusModal && (
                  <button
                    type="button"
                    onClick={onOpenFirestoreStatusModal}
                    className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200/80 dark:border-indigo-800/60 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>Open Live Sync Monitor</span>
                  </button>
                )}
              </div>

              {/* Compact Collection Sync List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(Object.values(firestoreStatus.collectionLogs || {}) as CollectionSyncLogEntry[]).map((item) => {
                  const hasTimestamp = Boolean(item.lastSyncTimestamp);
                  const timeDisplay = item.lastSyncTimestamp
                    ? new Date(item.lastSyncTimestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })
                    : 'Awaiting sync';

                  return (
                    <div
                      key={item.collection}
                      className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                          {item.displayName}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                          /{item.collection} • {item.itemCount} items
                        </span>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="flex items-center justify-end gap-1 text-[11px] font-bold text-slate-800 dark:text-slate-200">
                          {hasTimestamp && <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />}
                          <span>{timeDisplay}</span>
                        </div>
                        <span className="text-[9px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500">
                          {item.status === 'synced' ? 'Synced' : item.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Database: Firestore Cloud {firebaseConfig?.projectId ? `(${firebaseConfig.projectId})` : ''}</span>
                <a
                  href={firestoreStatus.databaseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  <span>Firebase Console</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
