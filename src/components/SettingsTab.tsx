import React, { useState } from 'react';
import { UserAccount } from '../types';
import { loadUsers, saveUsers, DEFAULT_ADMIN, resetAppToDefaults, exportChurchDataJSON } from '../utils/storage';
import {
  Settings,
  Sun,
  Moon,
  ShieldCheck,
  UserPlus,
  Trash2,
  Download,
  RotateCcw,
  LogOut,
  KeyRound,
  CheckCircle,
  AlertCircle,
  Users,
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

  const isAdmin = currentUser.role === 'admin' || currentUser.username.toLowerCase() === DEFAULT_ADMIN.username.toLowerCase();

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
    setUserCreatedMsg(`User "${cleanUser}" successfully created! They can now sign in with this password.`);
    setTimeout(() => setUserCreatedMsg(null), 4000);
  };

  const handleDeleteUser = (userId: string, username: string) => {
    if (username.toLowerCase() === DEFAULT_ADMIN.username.toLowerCase()) {
      alert('The root admin account cannot be deleted.');
      return;
    }

    if (confirm(`Are you sure you want to remove user access for "${username}"?`)) {
      const updated = users.filter((u) => u.id !== userId);
      saveUsers(updated);
      setUsers(updated);
    }
  };

  const handleExportBackup = () => {
    const jsonStr = exportChurchDataJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nlbc-program-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleResetData = () => {
    if (
      confirm(
        'Reset all church program data to original default setlists, songs, and recognitions? This will reload the default Quezon, Nueva Ecija church data.'
      )
    ) {
      resetAppToDefaults();
      onDataReset();
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-800 dark:text-slate-200" />
            <span>Settings & Preferences</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Appearance, account profile, user access permissions, and backups
          </p>
        </div>
      </div>

      {/* Section 1: Appearance & Theme */}
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
                {theme === 'dark' ? 'High-contrast eye-safe dark theme' : 'Crisp high-contrast clean daylight theme'}
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

      {/* Section 2: Active User Info */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
          Current User Account
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
                  ? 'Full administrative control + user access creation'
                  : 'Church member / worship team contributor'}
              </span>
            </div>
          </div>

          <button
            onClick={onSignOut}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Section 3: Create User Access (Admin Only) */}
      {isAdmin && (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Create User Access (Admin Only)</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Grant ministry team members access by creating their login credentials
              </p>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {users.length} Total Accounts
            </span>
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
          <form onSubmit={handleCreateUser} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  New Username *
                </label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. BroChristian / SisAbigail"
                  className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Password *
                </label>
                <input
                  type="text"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="e.g. worship2026"
                  className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-white shadow-xs"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Create User Access</span>
              </button>
            </div>
          </form>

          {/* Existing Users Table */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Active Authorized Accounts ({users.length})
            </span>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-200 dark:divide-slate-800">
              {users.map((u) => (
                <div key={u.id} className="p-3 bg-white dark:bg-slate-900 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-3">
                    <span className="font-bold text-slate-900 dark:text-white">{u.username}</span>
                    <span className="text-slate-400">|</span>
                    <span className="font-mono text-slate-500 dark:text-slate-400">Pass: {u.passwordHash}</span>
                    {u.role === 'admin' && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                        Admin
                      </span>
                    )}
                  </div>

                  {u.role !== 'admin' && u.username.toLowerCase() !== DEFAULT_ADMIN.username.toLowerCase() && (
                    <button
                      onClick={() => handleDeleteUser(u.id, u.username)}
                      className="p-1 text-slate-400 hover:text-rose-600"
                      title="Revoke User Access"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Section 4: Data Management & Backup */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
          Data Management & Backup
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={handleExportBackup}
            className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-left hover:border-slate-400 transition-all flex items-start space-x-3"
          >
            <div className="p-2 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 shrink-0">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block">
                Export JSON Backup
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Save full database of setlists, songs, celebrants, & visitors to a file
              </span>
            </div>
          </button>

          <button
            onClick={handleResetData}
            className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-left hover:border-rose-400 transition-all flex items-start space-x-3"
          >
            <div className="p-2 rounded-lg bg-white dark:bg-slate-900 text-rose-600 border border-slate-200 dark:border-slate-700 shrink-0">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block">
                Reset to Quezon Default Data
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Restore sample setlists, hymns, and recognitions for New Life Baptist Church
              </span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
