import React, { useState } from 'react';
import { UserAccount } from '../types';
import { supabase, isSupabaseConfigured } from '../supabase';
import { Lock, AlertCircle, ArrowRight, Eye, EyeOff, Loader2, User } from 'lucide-react';
import { ChurchLogo } from './ChurchLogo';

interface AuthScreenProps {
  onSignInSuccess: (user: UserAccount) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSignInSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password;

    if (!cleanUsername || !cleanPassword) {
      setErrorMsg('Please enter both username and password.');
      return;
    }

    if (!isSupabaseConfigured()) {
      setErrorMsg(
        'Supabase configuration is missing. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are configured in Settings.'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: authResult, error: authError } = await supabase.functions.invoke('username-auth', {
        body: { username: cleanUsername, password: cleanPassword },
      });
      const sessionResult = !authError && authResult?.access_token && authResult?.refresh_token
        ? await supabase.auth.setSession({ access_token: authResult.access_token, refresh_token: authResult.refresh_token })
        : await supabase.auth.signInWithPassword({
            // Transitional support for existing accounts until the username-auth
            // Edge Function is deployed. New managed accounts use the hidden address.
            email: cleanUsername.includes('@') ? cleanUsername : `${cleanUsername}@qnlbc.local`,
            password: cleanPassword,
          });
      const { data, error } = sessionResult;
      if (error || !data.user) {
        setErrorMsg('Sign-in failed. Please try again.');
        return;
      }
      await loadAndVerifyProfile(data.user.id);
    } catch (err: any) {
      console.error('Authentication exception:', err);
      setErrorMsg(err.message || 'An unexpected error occurred during authentication.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadAndVerifyProfile = async (userId: string) => {
    // Load signed-in user's row from public.profiles
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profileErr) {
      console.error('Profile fetch error:', profileErr);
      setErrorMsg('Failed to load user profile. Please check database permissions.');
      await supabase.auth.signOut();
      return;
    }

    if (!profile) {
      // If the trigger hasn't fired yet, try one more time after a brief moment
      await new Promise((r) => setTimeout(r, 600));
      const { data: retryProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!retryProfile) {
        setErrorMsg('User profile record not found. Please contact the administrator.');
        await supabase.auth.signOut();
        return;
      }

      if (!retryProfile.active) {
        await supabase.auth.signOut();
        setErrorMsg('This account has been deactivated. Please contact your church administrator.');
        return;
      }

      const userAccount: UserAccount = {
        id: retryProfile.id,
        username: retryProfile.username,
        displayName: retryProfile.display_name || retryProfile.username,
        display_name: retryProfile.display_name || retryProfile.username,
        role: retryProfile.role as 'admin' | 'user',
        active: Boolean(retryProfile.active),
        permissions: {
          canAdd: retryProfile.role === 'admin' || Boolean(retryProfile.can_add),
          canEdit: retryProfile.role === 'admin' || Boolean(retryProfile.can_edit),
          canDelete: retryProfile.role === 'admin' || Boolean(retryProfile.can_delete),
          canUpload: retryProfile.role === 'admin' || retryProfile.can_upload !== false,
        },
        avatar: retryProfile.avatar_url || undefined,
        avatarUrl: retryProfile.avatar_url || undefined,
        avatar_url: retryProfile.avatar_url || null,
        revision: Number(retryProfile.revision) || 1,
        createdAt: retryProfile.created_at,
        updatedAt: retryProfile.updated_at,
      };

      onSignInSuccess(userAccount);
      return;
    }

    // A disabled profile must be signed out and denied access (Requirement 4)
    if (!profile.active) {
      await supabase.auth.signOut();
      setErrorMsg('This account has been deactivated. Please contact your church administrator.');
      return;
    }

    const userAccount: UserAccount = {
      id: profile.id,
      username: profile.username,
      displayName: profile.display_name || profile.username,
      display_name: profile.display_name || profile.username,
      role: profile.role as 'admin' | 'user',
      active: Boolean(profile.active),
      permissions: {
        canAdd: profile.role === 'admin' || Boolean(profile.can_add),
        canEdit: profile.role === 'admin' || Boolean(profile.can_edit),
        canDelete: profile.role === 'admin' || Boolean(profile.can_delete),
        canUpload: profile.role === 'admin' || profile.can_upload !== false,
      },
      avatar: profile.avatar_url || undefined,
      avatarUrl: profile.avatar_url || undefined,
      avatar_url: profile.avatar_url || null,
      revision: Number(profile.revision) || 1,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    };

    onSignInSuccess(userAccount);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors">
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 shadow-sm flex items-center justify-center mb-4 overflow-hidden">
            <ChurchLogo className="w-full h-full object-contain" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            New Life Baptist Church
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 font-medium">
            Worship Ministry & Program Portal • Quezon, N.E.
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white dark:bg-slate-900 py-8 px-6 sm:px-10 shadow-sm border border-slate-200 dark:border-slate-800 rounded-2xl">
          <form className="space-y-4" onSubmit={handleSubmit}>
            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200/80 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs flex items-start space-x-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Username
              </label>
              <div className="relative rounded-xl shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  required
                  autoComplete="username"
                  autoCapitalize="none"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="block w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Password
              </label>
              <div className="relative rounded-xl shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="block w-full pl-9 pr-10 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 flex items-center justify-center py-2.5 px-4 border border-transparent rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Authorized church ministry portal for New Life Baptist Church.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
