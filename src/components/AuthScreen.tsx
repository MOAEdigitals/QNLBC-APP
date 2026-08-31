import React, { useState, useEffect } from 'react';
import { UserAccount } from '../types';
import { loadUsers, saveUsers, saveCurrentSession, DEFAULT_ADMIN } from '../utils/storage';
import { db } from '../firebase';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import { Lock, User, AlertCircle, ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react';
import { ChurchLogo } from './ChurchLogo';

interface AuthScreenProps {
  onSignInSuccess: (user: UserAccount) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSignInSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync users from Firestore in real-time so credentials created on other devices are immediately recognized
  useEffect(() => {
    try {
      const unsub = onSnapshot(
        collection(db, 'users'),
        (snapshot) => {
          if (!snapshot.empty) {
            const cloudUsers: UserAccount[] = [];
            snapshot.forEach((docSnap) => {
              cloudUsers.push({ ...(docSnap.data() as UserAccount), id: docSnap.id });
            });
            // Ensure DEFAULT_ADMIN is always included
            if (!cloudUsers.some((u) => u.username.toLowerCase() === DEFAULT_ADMIN.username.toLowerCase())) {
              cloudUsers.unshift(DEFAULT_ADMIN);
            }
            saveUsers(cloudUsers);
          }
        },
        () => {
          // Fallback silently if offline
        }
      );
      return () => unsub();
    } catch {
      return () => {};
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanUser = username.trim();
    const cleanPass = password;

    if (!cleanUser || !cleanPass) {
      setErrorMsg('Please enter both username and password.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Try local cache first
      let allUsers = loadUsers();
      let match = allUsers.find(
        (u) =>
          u.username.toLowerCase() === cleanUser.toLowerCase() &&
          u.passwordHash === cleanPass
      );

      // 2. If not found locally, fetch fresh user list directly from Firestore User Database
      if (!match) {
        try {
          const usersSnap = await getDocs(collection(db, 'users'));
          if (!usersSnap.empty) {
            const fetchedUsers: UserAccount[] = [];
            usersSnap.forEach((d) => {
              fetchedUsers.push({ ...(d.data() as UserAccount), id: d.id });
            });
            const userMap = new Map<string, UserAccount>();
            allUsers.forEach((u) => userMap.set(u.id || u.username.toLowerCase(), u));
            fetchedUsers.forEach((u) => userMap.set(u.id || u.username.toLowerCase(), u));
            const merged = Array.from(userMap.values());
            saveUsers(merged);

            match = merged.find(
              (u) =>
                u.username.toLowerCase() === cleanUser.toLowerCase() &&
                u.passwordHash === cleanPass
            );
          }
        } catch (dbErr) {
          console.warn('Could not query remote user database during sign in:', dbErr);
        }
      }

      if (match) {
        saveCurrentSession(match, rememberMe);
        onSignInSuccess(match);
      } else {
        setErrorMsg('Invalid username or password. Please check your credentials.');
      }
    } catch {
      setErrorMsg('An error occurred while authenticating. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl bg-white dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-md overflow-hidden">
            <ChurchLogo className="w-full h-full object-contain" />
          </div>
        </div>

        <h2 className="mt-4 text-center text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          New Life Baptist Church
        </h2>
        <p className="mt-1 text-center text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">
          Quezon, Nueva Ecija • Church Program System
        </p>
      </div>

      <div className="mt-6 sm:mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-slate-900 py-7 px-5 sm:py-8 sm:px-8 shadow-sm border border-slate-200 dark:border-slate-800 rounded-2xl">
          <form className="space-y-4 sm:space-y-5" onSubmit={handleSubmit}>
            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start space-x-3 text-rose-700 dark:text-rose-300 text-xs sm:text-sm">
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 mt-0.5" />
                <span className="leading-tight">{errorMsg}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="username"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Username
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="block w-full pl-10 pr-3.5 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400 text-sm transition-colors min-h-[44px]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Password
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="block w-full pl-10 pr-11 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400 text-sm transition-colors min-h-[44px]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer min-w-[40px] justify-center"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center space-x-2.5 cursor-pointer py-1">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-slate-900 rounded border-slate-300 dark:border-slate-700 dark:bg-slate-800 focus:ring-slate-900"
                />
                <span className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 select-none">
                  Keep me signed in
                </span>
              </label>
            </div>

            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center space-x-2 py-3.5 px-4 rounded-xl shadow-sm text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 transition-all disabled:opacity-50 cursor-pointer min-h-[48px]"
              >
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
          Internal Ministry System • New Life Baptist Church Quezon
        </p>
      </div>
    </div>
  );
};
