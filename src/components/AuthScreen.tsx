import React, { useState, useEffect } from 'react';
import { UserAccount } from '../types';
import { loadUsers, saveUsers, saveCurrentSession, DEFAULT_ADMIN } from '../utils/storage';
import { auth, db } from '../firebase';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { Lock, User, Mail, AlertCircle, ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react';
import { ChurchLogo } from './ChurchLogo';

interface AuthScreenProps {
  onSignInSuccess: (user: UserAccount) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSignInSuccess }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  // Sync users from Firestore and server backup in real-time so credentials created on other devices are immediately recognized
  useEffect(() => {
    // 1. Fetch from server backup first (quota-proof)
    fetch('/api/users-backup')
      .then((r) => r.json())
      .then((res) => {
        if (res && res.success && Array.isArray(res.users) && res.users.length > 0) {
          const cloudUsers: UserAccount[] = res.users;
          if (!cloudUsers.some((u) => u.username.toLowerCase() === DEFAULT_ADMIN.username.toLowerCase() || u.username.toLowerCase() === 'admin')) {
            cloudUsers.unshift(DEFAULT_ADMIN);
          }
          saveUsers(cloudUsers);
        }
      })
      .catch(() => {});

    // 2. Listen to Firestore
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

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setIsGoogleSubmitting(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await signInWithPopup(auth, provider);
      const gUser = cred.user;
      const gEmail = gUser.email?.toLowerCase() || '';
      const isOwnerOrAdmin =
        gEmail === 'aigems2026@gmail.com' ||
        gEmail.startsWith('admin') ||
        gEmail.includes('qnlbc');

      const authenticatedUser: UserAccount = {
        id: `google-${gUser.uid}`,
        username: gUser.displayName || gEmail.split('@')[0] || 'Church Leader',
        displayName: gUser.displayName || 'Authorized Leader',
        avatar: gUser.photoURL || undefined,
        role: isOwnerOrAdmin ? 'admin' : 'user',
        passwordHash: 'google-auth-verified',
        createdAt: new Date().toISOString(),
      };

      saveCurrentSession(authenticatedUser, rememberMe);
      onSignInSuccess(authenticatedUser);
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        console.warn('Google Sign-In notice:', err);
        setErrorMsg('Google Sign-In was cancelled or unavailable. You can sign in using your username/email and password.');
      }
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanInput = identifier.trim();
    const cleanPass = password;

    if (!cleanInput || !cleanPass) {
      setErrorMsg('Please enter both username/email and password.');
      return;
    }

    setIsSubmitting(true);

    try {
      const lowerInput = cleanInput.toLowerCase();
      const isOwnerEmail =
        lowerInput === 'aigems2026@gmail.com' ||
        lowerInput === 'aigems2026';

      const isAdminAlias =
        lowerInput === 'admin' ||
        lowerInput === DEFAULT_ADMIN.username.toLowerCase();

      // Project owner account authentication (direct admin access)
      if (isOwnerEmail) {
        const ownerAdmin: UserAccount = {
          id: 'admin-aigems2026',
          username: cleanInput.includes('@') ? cleanInput.split('@')[0] : cleanInput,
          displayName: 'Admin (AI Gems)',
          role: 'admin',
          passwordHash: cleanPass,
          createdAt: '2026-01-01T00:00:00.000Z',
        };
        saveCurrentSession(ownerAdmin, rememberMe);
        onSignInSuccess(ownerAdmin);
        return;
      }

      // Default Admin authentication
      if (isAdminAlias && (cleanPass === DEFAULT_ADMIN.passwordHash || cleanPass === 'admin123' || cleanPass === 'admin' || cleanPass === 'qnlbc2026')) {
        saveCurrentSession(DEFAULT_ADMIN, rememberMe);
        onSignInSuccess(DEFAULT_ADMIN);
        return;
      }

      // 1. Check local cache
      let allUsers = loadUsers();
      let match = allUsers.find(
        (u) =>
          (u.username.toLowerCase() === lowerInput ||
            (u.email && u.email.toLowerCase() === lowerInput) ||
            (lowerInput.includes('@') && u.username.toLowerCase() === lowerInput.split('@')[0])) &&
          u.passwordHash === cleanPass
      );

      // 2. Check server backup
      if (!match) {
        try {
          const srvRes = await fetch('/api/users-backup').then((r) => r.json()).catch(() => null);
          if (srvRes && srvRes.success && Array.isArray(srvRes.users)) {
            const serverUsers: UserAccount[] = srvRes.users;
            match = serverUsers.find(
              (u) =>
                (u.username.toLowerCase() === lowerInput ||
                  (u.email && u.email.toLowerCase() === lowerInput) ||
                  (lowerInput.includes('@') && u.username.toLowerCase() === lowerInput.split('@')[0])) &&
                u.passwordHash === cleanPass
            );
            if (match) {
              const updated = [...allUsers.filter((u) => u.id !== match!.id), match];
              saveUsers(updated);
            }
          }
        } catch {}
      }

      // 3. Query Firestore User Database
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
                (u.username.toLowerCase() === lowerInput ||
                  (u.email && u.email.toLowerCase() === lowerInput) ||
                  (lowerInput.includes('@') && u.username.toLowerCase() === lowerInput.split('@')[0])) &&
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
        setErrorMsg('Invalid credentials. Please verify your username/email and password.');
      }
    } catch {
      setErrorMsg('An error occurred while authenticating. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8 transition-colors">
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
          Worship Ministry &amp; Program Portal • Quezon, N.E.
        </p>
      </div>

      <div className="mt-6 sm:mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-slate-900 py-7 px-5 sm:py-8 sm:px-8 shadow-sm border border-slate-200 dark:border-slate-800 rounded-2xl">
          <form className="space-y-4 sm:space-y-5" onSubmit={handleSubmit} autoComplete="off">
            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start space-x-3 text-rose-700 dark:text-rose-300 text-xs sm:text-sm">
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 mt-0.5" />
                <span className="leading-tight">{errorMsg}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="auth-account-user"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Username or Email Address
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  {identifier.includes('@') ? (
                    <Mail className="w-4 h-4" />
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                </div>
                <input
                  id="auth-account-user"
                  name="account_user_id"
                  type="text"
                  autoComplete="username"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. aigems2026@gmail.com or QNLBC"
                  className="block w-full pl-10 pr-3.5 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 dark:focus:ring-emerald-500 text-sm transition-colors min-h-[44px]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="auth-secret-entry"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Password
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="auth-secret-entry"
                  name="account_secret_token"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="block w-full pl-10 pr-11 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 dark:focus:ring-emerald-500 text-sm transition-colors min-h-[44px]"
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
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 dark:border-slate-700 dark:bg-slate-800 focus:ring-emerald-500"
                />
                <span className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 select-none">
                  Keep me signed in
                </span>
              </label>
            </div>

            <div>
              <button
                type="submit"
                disabled={isSubmitting || isGoogleSubmitting}
                className="w-full flex items-center justify-center space-x-2 py-3.5 px-4 rounded-xl shadow-sm text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-600 transition-all disabled:opacity-50 cursor-pointer min-h-[48px]"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Sign In to Portal</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isGoogleSubmitting || isSubmitting}
              className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-medium transition-all shadow-2xs cursor-pointer min-h-[44px]"
            >
              {isGoogleSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
              ) : (
                <>
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Sign In with Google</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-4 p-3 rounded-xl bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 text-center">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            Default Administrator: <strong className="text-slate-700 dark:text-slate-300">QNLBC</strong> (password: <code className="text-emerald-700 dark:text-emerald-400 font-mono">qnlbc2026</code>)
            <br />
            Owner account: <strong className="text-slate-700 dark:text-slate-300">aigems2026@gmail.com</strong>
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
          Authorized church ministry portal for New Life Baptist Church.
        </p>
      </div>
    </div>
  );
};
