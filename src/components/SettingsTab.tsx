import React, { useState } from 'react';
import { UserAccount } from '../types';
import {
  loadUsers,
  saveUsers,
  DEFAULT_ADMIN,
  resetAppToDefaults,
  exportChurchDataJSON,
  importChurchDataJSON,
  importBatchLyricsTxt,
  loadSavedNames,
  saveSavedNames,
} from '../utils/storage';
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
} from 'lucide-react';

interface SettingsTabProps {
  currentUser: UserAccount;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onSignOut: () => void;
  onDataReset: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  currentUser,
  theme,
  onToggleTheme,
  onSignOut,
  onDataReset,
}) => {
  const [users, setUsers] = useState<UserAccount[]>(() => loadUsers());
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [userCreatedMsg, setUserCreatedMsg] = useState<string | null>(null);
  const [userErrorMsg, setUserErrorMsg] = useState<string | null>(null);

  // Church directory names state for autofill management
  const [savedNames, setSavedNames] = useState<string[]>(() => loadSavedNames());
  const [newNameInput, setNewNameInput] = useState('');
  const [importStatus, setImportStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [lyricsImportStatus, setLyricsImportStatus] = useState<{ success: boolean; message: string } | null>(null);

  const isAdmin =
    currentUser.role === 'admin' ||
    currentUser.username.toLowerCase() === DEFAULT_ADMIN.username.toLowerCase();

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
      createdAt: new Date().toISOString(),
    };

    const updated = [...users, newUser];
    saveUsers(updated);
    setUsers(updated);
    setNewUsername('');
    setNewPassword('');
    setUserCreatedMsg(`User access successfully generated for "${cleanUser}".`);
    setTimeout(() => setUserCreatedMsg(null), 4000);
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
    setNewNameInput('');
  };

  const handleDeleteDirectoryName = (nameToDelete: string) => {
    const updated = savedNames.filter((n) => n !== nameToDelete);
    saveSavedNames(updated);
    setSavedNames(updated);
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
          setSavedNames(loadSavedNames());
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
      setSavedNames(loadSavedNames());
      onDataReset();
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-16">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-800 dark:text-slate-200" />
            <span>Settings</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {isAdmin
              ? 'Full data backup & restore, lyrics batch import, directory autofill, and account access'
              : 'Theme appearance and account session settings'}
          </p>
        </div>
      </div>

      {/* Section 1: Appearance & Theme (Accessible to Everyone) */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
          Appearance & Theme
        </h3>

        <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 shadow-xs">
              {theme === 'dark' ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
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

      {/* Section 2: Batch TXT Lyrics Import (Admin Only) */}
      {isAdmin && (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-700 dark:text-slate-300" />
              <span>Batch Import Lyrics (.txt files)</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Import multiple text files at once. 1 text file = 1 song. The file name is used as the song title, and the text inside becomes the lyrics.
            </p>
          </div>

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
                Select / Upload Multiple .txt Files
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 block">
                Click here to choose multiple .txt files from your device (e.g. "Amazing Grace.txt", "Dakilang Katapatan.txt").
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
      )}

      {/* Section 3: Complete Data Backup & Restore (Admin Only) */}
      {isAdmin && (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Database className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                <span>Full Data Export & Restore</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Export all setlists, shared songs, special song numbers, recognitions, and directories into a single file to prevent data loss.
              </p>
            </div>
          </div>

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
            {/* Export Button */}
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
                  Downloads all setlists, songs library, special song numbers, and member directories.
                </span>
              </div>
            </button>

            {/* Import / Load File */}
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

      {/* Section 4: Directory Names for Autofill (Admin Only) */}
      {isAdmin && (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                <span>Church Directory & Autofill Suggestions ({savedNames.length})</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Names listed here appear automatically as smart autocomplete suggestions for Presiders, Song Leaders, and Special Song Number performers.
              </p>
            </div>
          </div>

          {/* Add name input */}
          <form onSubmit={handleAddDirectoryName} className="flex items-center gap-2">
            <input
              type="text"
              value={newNameInput}
              onChange={(e) => setNewNameInput(e.target.value)}
              placeholder="Add new member name (e.g. Bro. Juan Dela Cruz)..."
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs sm:text-sm font-semibold flex items-center gap-1.5 shrink-0 hover:bg-slate-800"
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

      {/* Section 5: Current Account Session (Accessible to Everyone) */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
          Account Session
        </h3>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 flex items-center justify-center font-bold">
              {currentUser.username.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {currentUser.username}
                </span>
                {isAdmin && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
                    Administrator
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {isAdmin
                  ? 'Administrator account with full ministry program privileges'
                  : 'Ministry team contributor account'}
              </span>
            </div>
          </div>

          <button
            onClick={onSignOut}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Section 6: Create User Access (Admin Only) */}
      {isAdmin && (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Create Ministry User Access</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Add login access for team members. Account details and passwords remain confidential and are not listed publicly.
            </p>
          </div>

          {userCreatedMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-start gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{userCreatedMsg}</span>
            </div>
          )}

          {userErrorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-2 text-xs font-semibold text-rose-800 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{userErrorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleCreateUser} className="p-4 sm:p-5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  New Username *
                </label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. BroChristian / SisAbigail"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Assigned Password *
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Private password"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs sm:text-sm font-semibold hover:bg-slate-800 dark:hover:bg-white shadow-xs cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Create User Access</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

