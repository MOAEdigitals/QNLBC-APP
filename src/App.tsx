import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  UserAccount,
  AppTab,
  Setlist,
  SetlistSongItem,
  Song,
  BirthdayCelebrant,
  AnniversaryCelebrant,
  Visitor,
  SpecialRecognition,
  SpecialNumberEntry,
  PracticeGroupEntry,
  ChoirEntry,
  DatabaseStatusInfo,
} from './types';
import { supabase } from './supabase';
import {
  fetchSetlists,
  saveSetlist as supabaseSaveSetlist,
  deleteSetlist as supabaseDeleteSetlist,
  fetchSongs,
  saveSong as supabaseSaveSong,
  deleteSong as supabaseDeleteSong,
  fetchSpecialNumbers,
  saveSpecialNumber as supabaseSaveSpecialNumber,
  deleteSpecialNumber as supabaseDeleteSpecialNumber,
  fetchChoirEntries,
  saveChoirEntry as supabaseSaveChoirEntry,
  deleteChoirEntry as supabaseDeleteChoirEntry,
  fetchPracticeEntries,
  createPracticeEntry as supabaseCreatePracticeEntry,
  updatePracticeEntry as supabaseUpdatePracticeEntry,
  savePracticeEntry as supabaseSavePracticeEntry,
  deletePracticeEntry as supabaseDeletePracticeEntry,
  savePracticeVocalPart as supabaseSavePracticeVocalPart,
  savePracticeAttachment as supabaseSavePracticeAttachment,
  formatSupabaseError,
  executeSoftDelete,
  fetchBirthdays,
  saveBirthday as supabaseSaveBirthday,
  deleteBirthday as supabaseDeleteBirthday,
  fetchAnniversaries,
  saveAnniversary as supabaseSaveAnniversary,
  deleteAnniversary as supabaseDeleteAnniversary,
  fetchVisitors,
  saveVisitor as supabaseSaveVisitor,
  deleteVisitor as supabaseDeleteVisitor,
  fetchSpecialRecognitions,
  saveSpecialRecognition as supabaseSaveSpecialRecognition,
  deleteSpecialRecognition as supabaseDeleteSpecialRecognition,
  fetchMinistrySavedNames,
  saveMinistrySavedNames as supabaseSaveMinistrySavedNames,
  fetchAllProfiles,
  fetchCurrentUserProfile,
  subscribeSupabaseRealtime,
  getDatabaseConnectionStatus,
  generateUUID,
  isUUID,
} from './services/supabaseData';
import {
  cleanupLegacyStorage,
  loadTheme,
  saveTheme,
  upsertSongFromSpecialNumber,
  loadWelcomeSongs,
} from './utils/storage';
import {
  categorizeAnnualCelebrants,
  isPastDate,
  getNextSundayStr,
} from './utils/dateUtils';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { AuthScreen } from './components/AuthScreen';
import { SetlistsTab } from './components/SetlistsTab';
import { RecognitionsTab } from './components/RecognitionsTab';
import { SpecialNumberTab } from './components/SpecialNumberTab';
import { SongsTab } from './components/SongsTab';
import { SettingsTab } from './components/SettingsTab';
import { FirestoreStatusModal } from './components/FirestoreStatusModal';
import { ChurchLogo } from './components/ChurchLogo';
import { LogOut, X, AlertTriangle, CloudOff } from 'lucide-react';

// Execute legacy storage purge immediately before any component lifecycle
cleanupLegacyStorage();

export default function App() {
  // 1. Auth and Loading States
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [isLoadingInitialData, setIsLoadingInitialData] = useState<boolean>(true);

  // Connection Status
  const [dbStatus, setDbStatus] = useState<DatabaseStatusInfo>(() =>
    getDatabaseConnectionStatus()
  );
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  // 2. Personal Display Preferences (Preserved)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => loadTheme());

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    saveTheme(theme);
  }, [theme]);

  // Active Tab & Browser Navigation (Preserved)
  const [currentTab, setCurrentTab] = useState<AppTab>(() => {
    const hash = window.location.hash.replace('#', '');
    const validTabs: AppTab[] = ['home', 'recognitions', 'special-numbers', 'songs', 'settings'];
    if (hash && validTabs.includes(hash as AppTab)) {
      return hash as AppTab;
    }
    try {
      const savedTab = localStorage.getItem('nlbc_active_tab_v1');
      if (savedTab && validTabs.includes(savedTab as AppTab)) {
        return savedTab as AppTab;
      }
    } catch {}
    return 'home';
  });

  const [showLogoutConfirmModal, setShowLogoutConfirmModal] = useState(false);
  const tabHistoryRef = useRef<AppTab[]>([currentTab]);
  const hasActiveSubViewRef = useRef(false);
  const [collapseSignals, setCollapseSignals] = useState<Record<string, number>>({});

  useEffect(() => {
    try {
      localStorage.setItem('nlbc_active_tab_v1', currentTab);
    } catch {}
  }, [currentTab]);

  // Deep linking and navigation helpers
  const [selectedSongIdForTab, setSelectedSongIdForTab] = useState<string | null>(null);
  const [songNavigationTrigger, setSongNavigationTrigger] = useState<{ songId: string; timestamp: number } | null>(null);
  const [initialSelectedSetlistId, setInitialSelectedSetlistId] = useState<string | null>(null);
  const returnSetlistIdRef = useRef<string | null>(null);

  // 3. Shared Collections: MUST start strictly as empty arrays - no localStorage loaders!
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [birthdays, setBirthdays] = useState<BirthdayCelebrant[]>([]);
  const [anniversaries, setAnniversaries] = useState<AnniversaryCelebrant[]>([]);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [specialRecognitions, setSpecialRecognitions] = useState<SpecialRecognition[]>([]);
  const [specialNumbers, setSpecialNumbers] = useState<SpecialNumberEntry[]>([]);
  const [choirEntries, setChoirEntries] = useState<ChoirEntry[]>([]);
  const [practiceEntries, setPracticeEntries] = useState<PracticeGroupEntry[]>([]);
  const [savedNames, setSavedNames] = useState<string[]>([]);

  // 4. Initial Authoritative Load and Session Management
  useEffect(() => {
    let isMounted = true;
    cleanupLegacyStorage();

    async function initSessionAndData() {
      try {
        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr || !sessionData?.session?.user) {
          if (isMounted) {
            setCurrentUser(null);
            setIsLoadingInitialData(false);
          }
          return;
        }

        const userId = sessionData.session.user.id;
        const profile = await fetchCurrentUserProfile(userId);

        if (!profile || !profile.active) {
          await supabase.auth.signOut();
          if (isMounted) {
            setCurrentUser(null);
            setIsLoadingInitialData(false);
          }
          return;
        }

        if (isMounted) {
          setCurrentUser(profile);
        }

        // Fetch authoritative shared records directly from Supabase
        const [
          serverSetlists,
          serverSongs,
          serverSpecialNumbers,
          serverChoir,
          serverPractices,
          serverBirthdays,
          serverAnniversaries,
          serverVisitors,
          serverRecognitions,
          serverSavedNames,
          serverProfiles,
        ] = await Promise.all([
          fetchSetlists().catch(() => []),
          fetchSongs().catch(() => []),
          fetchSpecialNumbers().catch(() => []),
          fetchChoirEntries().catch(() => []),
          fetchPracticeEntries().catch(() => []),
          fetchBirthdays().catch(() => []),
          fetchAnniversaries().catch(() => []),
          fetchVisitors().catch(() => []),
          fetchSpecialRecognitions().catch(() => []),
          fetchMinistrySavedNames().catch(() => []),
          fetchAllProfiles().catch(() => []),
        ]);

        if (isMounted) {
          setSetlists(serverSetlists);
          setSongs(serverSongs);
          setSpecialNumbers(serverSpecialNumbers);
          setChoirEntries(serverChoir);
          setPracticeEntries(serverPractices);
          setBirthdays(serverBirthdays);
          setAnniversaries(serverAnniversaries);
          setVisitors(serverVisitors);
          setSpecialRecognitions(serverRecognitions);
          setSavedNames(serverSavedNames);
          setUsers(serverProfiles);
          setIsLoadingInitialData(false);
        }
      } catch (err) {
        console.error('Failed to initialize authoritative data:', err);
        if (isMounted) {
          setIsLoadingInitialData(false);
        }
      }
    }

    initSessionAndData();

    // Listen to Supabase Auth changes
    const { data: authSub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        if (isMounted) {
          setCurrentUser(null);
          setSetlists([]);
          setSongs([]);
          setBirthdays([]);
          setAnniversaries([]);
          setVisitors([]);
          setSpecialRecognitions([]);
          setSpecialNumbers([]);
          setChoirEntries([]);
          setPracticeEntries([]);
          setUsers([]);
          setIsLoadingInitialData(false);
        }
      } else if (event === 'SIGNED_IN' && session) {
        const profile = await fetchCurrentUserProfile(session.user.id);
        if (isMounted && profile && profile.active) {
          setCurrentUser(profile);
        }
      }
    });

    // Realtime changes listener
    const unsubRealtime = subscribeSupabaseRealtime({
      onSetlistsChange: async () => {
        const fresh = await fetchSetlists().catch(() => []);
        if (isMounted) setSetlists(fresh);
      },
      onSongsChange: async () => {
        const fresh = await fetchSongs().catch(() => []);
        if (isMounted) setSongs(fresh);
      },
      onSpecialNumbersChange: async () => {
        const fresh = await fetchSpecialNumbers().catch(() => []);
        if (isMounted) setSpecialNumbers(fresh);
      },
      onChoirChange: async () => {
        const fresh = await fetchChoirEntries().catch(() => []);
        if (isMounted) setChoirEntries(fresh);
      },
      onPracticeChange: async () => {
        const fresh = await fetchPracticeEntries().catch(() => []);
        if (isMounted) setPracticeEntries(fresh);
      },
      onBirthdaysChange: async () => {
        const fresh = await fetchBirthdays().catch(() => []);
        if (isMounted) setBirthdays(fresh);
      },
      onAnniversariesChange: async () => {
        const fresh = await fetchAnniversaries().catch(() => []);
        if (isMounted) setAnniversaries(fresh);
      },
      onVisitorsChange: async () => {
        const fresh = await fetchVisitors().catch(() => []);
        if (isMounted) setVisitors(fresh);
      },
      onRecognitionsChange: async () => {
        const fresh = await fetchSpecialRecognitions().catch(() => []);
        if (isMounted) setSpecialRecognitions(fresh);
      },
      onProfilesChange: async () => {
        const fresh = await fetchAllProfiles().catch(() => []);
        const { data: authData } = await supabase.auth.getUser();
        const refreshedCurrent = authData.user
          ? await fetchCurrentUserProfile(authData.user.id).catch(() => null)
          : null;
        if (isMounted) {
          setUsers(fresh);
          if (refreshedCurrent?.active) setCurrentUser(refreshedCurrent);
        }
      },
      onStatusChange: (status) => {
        if (isMounted) setDbStatus(status);
      },
    });

    return () => {
      isMounted = false;
      authSub.subscription.unsubscribe();
      unsubRealtime();
    };
  }, []);

  // Reload data from Supabase
  const reloadAllData = async () => {
    try {
      const [
        sList,
        sSongs,
        sSpec,
        sChoir,
        sPrac,
        sBday,
        sAnniv,
        sVis,
        sRecog,
        sNames,
        sUsers,
      ] = await Promise.all([
        fetchSetlists().catch(() => []),
        fetchSongs().catch(() => []),
        fetchSpecialNumbers().catch(() => []),
        fetchChoirEntries().catch(() => []),
        fetchPracticeEntries().catch(() => []),
        fetchBirthdays().catch(() => []),
        fetchAnniversaries().catch(() => []),
        fetchVisitors().catch(() => []),
        fetchSpecialRecognitions().catch(() => []),
        fetchMinistrySavedNames().catch(() => []),
        fetchAllProfiles().catch(() => []),
      ]);

      setSetlists(sList);
      setSongs(sSongs);
      setSpecialNumbers(sSpec);
      setChoirEntries(sChoir);
      setPracticeEntries(sPrac);
      setBirthdays(sBday);
      setAnniversaries(sAnniv);
      setVisitors(sVis);
      setSpecialRecognitions(sRecog);
      setSavedNames(sNames);
      setUsers(sUsers);
    } catch (e) {
      console.warn('Error refreshing data from Supabase', e);
    }
  };

  // Tab Navigation
  const handleNavigateTab = useCallback(
    (newTab: AppTab) => {
      if (newTab === currentTab) {
        setCollapseSignals((prev) => ({
          ...prev,
          [newTab]: (prev[newTab] || 0) + 1,
        }));
        return;
      }
      window.history.pushState({ tab: newTab }, '', `#${newTab}`);
      tabHistoryRef.current.push(newTab);
      setCurrentTab(newTab);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [currentTab]
  );

  // Popstate history listener
  useEffect(() => {
    if (!window.history.state || !window.history.state.tab) {
      window.history.replaceState({ tab: currentTab }, '', `#${currentTab}`);
    }

    const handlePopState = (event: PopStateEvent) => {
      const targetTab: AppTab = event.state?.tab || 'home';
      if (currentTab !== 'home') {
        if (targetTab === 'home' && returnSetlistIdRef.current) {
          setInitialSelectedSetlistId(returnSetlistIdRef.current);
          returnSetlistIdRef.current = null;
        }
        setCurrentTab(targetTab);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        if (hasActiveSubViewRef.current) return;
        setShowLogoutConfirmModal(true);
        window.history.pushState({ tab: 'home' }, '', '#home');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [currentTab]);

  // Auth Handlers
  const handleSignInSuccess = async (user: UserAccount) => {
    setCurrentUser(user);
    setIsLoadingInitialData(true);
    await reloadAllData();
    setIsLoadingInitialData(false);
    setCurrentTab('home');
    tabHistoryRef.current = ['home'];
    window.history.replaceState({ tab: 'home' }, '', '#home');
  };

  const handleSignOut = async () => {
    setShowLogoutConfirmModal(false);
    await supabase.auth.signOut();
    setCurrentUser(null);
    setSetlists([]);
    setSongs([]);
    setBirthdays([]);
    setAnniversaries([]);
    setVisitors([]);
    setSpecialRecognitions([]);
    setSpecialNumbers([]);
    setChoirEntries([]);
    setPracticeEntries([]);
    setUsers([]);
    window.history.replaceState(null, '', window.location.pathname);
  };

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const hasPermission = (permission: 'add' | 'edit' | 'delete' | 'upload') => {
    if (currentUser?.role === 'admin') return true;
    const key = {
      add: 'canAdd',
      edit: 'canEdit',
      delete: 'canDelete',
      upload: 'canUpload',
    }[permission] as keyof NonNullable<UserAccount['permissions']>;
    return Boolean(currentUser?.active && currentUser.permissions?.[key]);
  };

  const requirePermission = (permission: 'add' | 'edit' | 'delete' | 'upload') => {
    if (hasPermission(permission)) return true;
    alert(`Your account does not have ${permission.toUpperCase()} permission. Please contact an administrator.`);
    return false;
  };

  // Setlist Operations
  const handleSaveSetlist = useCallback(async (newOrUpdated: Setlist) => {
    const isNew = !setlists.some((s) => s.id === newOrUpdated.id);
    if (!requirePermission(isNew ? 'add' : 'edit')) return;

    try {
      const saved = await supabaseSaveSetlist(newOrUpdated, isNew);
      setSetlists((prev) =>
        isNew
          ? [saved, ...prev.filter((s) => s.id !== newOrUpdated.id && s.id !== saved.id)]
          : prev.map((s) => (s.id === newOrUpdated.id ? saved : s))
      );
    } catch (err: any) {
      console.error('Failed to save setlist to Supabase:', err);
      // Refresh authoritative list
      const fresh = await fetchSetlists().catch(() => []);
      setSetlists(fresh);
      alert('Unable to save setlist: ' + (err.message || 'Database error'));
    }
  }, [setlists, currentUser]);

  const handleDeleteSetlist = useCallback(async (id: string) => {
    if (!requirePermission('delete')) return;
    const target = setlists.find((s) => s.id === id);
    setSetlists((prev) => prev.filter((s) => s.id !== id));

    try {
      await supabaseDeleteSetlist(id, target?.revision || 1);
    } catch (err: any) {
      console.error('Failed to delete setlist from Supabase:', err);
      const fresh = await fetchSetlists().catch(() => []);
      setSetlists(fresh);
      alert('Unable to delete setlist: ' + (err.message || 'Database error'));
    }
  }, [setlists, currentUser]);

  // Song Operations
  const handleSaveSong = useCallback(async (newOrUpdated: Song) => {
    const isNew = !songs.some((s) => s.id === newOrUpdated.id);
    if (!requirePermission(isNew ? 'add' : 'edit')) {
      throw new Error(`Your account does not have ${isNew ? 'ADD' : 'EDIT'} permission.`);
    }

    try {
      const saved = await supabaseSaveSong(newOrUpdated, isNew);
      setSongs((prev) =>
        isNew
          ? [...prev.filter((s) => s.id !== newOrUpdated.id && s.id !== saved.id), saved]
          : prev.map((s) => (s.id === newOrUpdated.id ? saved : s))
      );
      return saved;
    } catch (err: any) {
      console.error('Failed to save song to Supabase:', err);
      const fresh = await fetchSongs().catch(() => []);
      setSongs(fresh);
      alert('Unable to save song: ' + (err.message || 'Database error'));
      throw err;
    }
  }, [songs, currentUser]);

  const handleBatchSaveSongs = useCallback(async (updatedSongs: Song[]) => {
    for (const song of updatedSongs) {
      try {
        const isNew = !songs.some((existing) => existing.id === song.id);
        if (!requirePermission(isNew ? 'add' : 'edit')) return;
        const saved = await supabaseSaveSong(song, isNew);
        setSongs((prev) => {
          const withoutDraft = prev.filter((s) => s.id !== song.id && s.id !== saved.id);
          return [...withoutDraft, saved];
        });
      } catch (err) {
        console.error('Failed to batch save song:', song.title, err);
      }
    }
  }, [songs, currentUser]);

  const handleDeleteSong = useCallback(async (id: string) => {
    if (!requirePermission('delete')) return;
    const target = songs.find((s) => s.id === id);
    setSongs((prev) => prev.filter((s) => s.id !== id));

    try {
      await supabaseDeleteSong(id, target?.revision || 1);
    } catch (err: any) {
      console.error('Failed to delete song from Supabase:', err);
      const fresh = await fetchSongs().catch(() => []);
      setSongs(fresh);
      alert('Unable to delete song: ' + (err.message || 'Database error'));
    }
  }, [songs, currentUser]);

  // Special Number Operations
  const handleSaveSpecialNumber = async (entry: SpecialNumberEntry) => {
    const isNew = !specialNumbers.some((item) => item.id === entry.id);
    if (!requirePermission(isNew ? 'add' : 'edit')) return;
    let entryToSave = { ...entry };

    if (entry.songTitle && entry.lyrics) {
      const existingSong = songs.find(
        (song) => song.title.trim().toLowerCase() === entry.songTitle!.trim().toLowerCase()
      );
      const songDraft = existingSong
        ? {
            ...existingSong,
            lyrics: entry.lyrics,
            minusOneLink: entry.minusOneLink || existingSong.minusOneLink,
            updatedAt: new Date().toISOString(),
          }
        : upsertSongFromSpecialNumber(entry.songTitle, entry.lyrics, entry.minusOneLink);
      const savedSong = await supabaseSaveSong(songDraft, !existingSong);
      setSongs((prev) => {
        const withoutOld = prev.filter(
          (song) => song.id !== songDraft.id && song.id !== savedSong.id
        );
        return [...withoutOld, savedSong];
      });
      entryToSave = { ...entryToSave, songId: savedSong.id };
    }

    try {
      const saved = await supabaseSaveSpecialNumber(entryToSave, isNew);
      setSpecialNumbers((prev) =>
        isNew
          ? [saved, ...prev.filter((item) => item.id !== entry.id && item.id !== saved.id)]
          : prev.map((item) => (item.id === entry.id ? saved : item))
      );
    } catch (err: any) {
      console.error('Failed to save special number:', err);
      const fresh = await fetchSpecialNumbers().catch(() => []);
      setSpecialNumbers(fresh);
      alert('Unable to save special number: ' + (err.message || 'Database error'));
    }
  };

  const handleDeleteSpecialNumber = async (id: string) => {
    if (!requirePermission('delete')) return;
    const target = specialNumbers.find((s) => s.id === id);
    setSpecialNumbers((prev) => prev.filter((s) => s.id !== id));
    try {
      await supabaseDeleteSpecialNumber(id, target?.revision || 1);
    } catch (err: any) {
      console.error('Failed to delete special number:', err);
      const fresh = await fetchSpecialNumbers().catch(() => []);
      setSpecialNumbers(fresh);
    }
  };

  // Choir Operations
  const handleSaveChoirEntry = async (entry: ChoirEntry) => {
    const isNew = !choirEntries.some((item) => item.id === entry.id);
    if (!requirePermission(isNew ? 'add' : 'edit')) return;
    let entryToSave = { ...entry };

    if (entry.songTitle && entry.lyrics) {
      const existingSong = songs.find(
        (song) => song.title.trim().toLowerCase() === entry.songTitle.trim().toLowerCase()
      );
      const songDraft = existingSong
        ? {
            ...existingSong,
            lyrics: entry.lyrics,
            updatedAt: new Date().toISOString(),
          }
        : upsertSongFromSpecialNumber(entry.songTitle, entry.lyrics);
      const savedSong = await supabaseSaveSong(songDraft, !existingSong);
      setSongs((prev) => {
        const withoutOld = prev.filter(
          (song) => song.id !== songDraft.id && song.id !== savedSong.id
        );
        return [...withoutOld, savedSong];
      });
      entryToSave = { ...entryToSave, songId: savedSong.id };
    }

    try {
      const saved = await supabaseSaveChoirEntry(entryToSave, isNew);
      setChoirEntries((prev) =>
        isNew
          ? [saved, ...prev.filter((item) => item.id !== entry.id && item.id !== saved.id)]
          : prev.map((item) => (item.id === entry.id ? saved : item))
      );
    } catch (err: any) {
      console.error('Failed to save choir presentation:', err);
      const fresh = await fetchChoirEntries().catch(() => []);
      setChoirEntries(fresh);
      alert('Unable to save choir presentation: ' + (err.message || 'Database error'));
    }
  };

  const handleDeleteChoirEntry = async (id: string) => {
    if (!requirePermission('delete')) return;
    const target = choirEntries.find((c) => c.id === id);
    setChoirEntries((prev) => prev.filter((c) => c.id !== id));
    try {
      await supabaseDeleteChoirEntry(id, target?.revision || 1);
    } catch (err: any) {
      console.error('Failed to delete choir presentation:', err);
      const fresh = await fetchChoirEntries().catch(() => []);
      setChoirEntries(fresh);
    }
  };

  // Practice Group Operations
  const handleSavePracticeEntry = async (
    entry: Partial<PracticeGroupEntry>,
    isNew?: boolean
  ): Promise<PracticeGroupEntry> => {
    const isActuallyNew = Boolean(
      isNew || !entry.id || !practiceEntries.some((p) => p.id === entry.id)
    );
    if (!requirePermission(isActuallyNew ? 'add' : 'edit')) {
      throw new Error(`Your account does not have ${isActuallyNew ? 'ADD' : 'EDIT'} permission.`);
    }

    if (isActuallyNew) {
      try {
        const saved = await supabaseCreatePracticeEntry(entry);
        setPracticeEntries((prev) => [saved, ...prev.filter((p) => p.id !== saved.id)]);
        return saved;
      } catch (err: any) {
        console.error('Failed to create practice entry:', formatSupabaseError(err), err);
        const fresh = await fetchPracticeEntries().catch(() => []);
        setPracticeEntries(fresh);
        alert('Unable to save practice: ' + (err.message || 'Database error'));
        throw err;
      }
    } else {
      try {
        const saved = await supabaseUpdatePracticeEntry(entry.id!, entry);
        setPracticeEntries((prev) => prev.map((p) => (p.id === entry.id ? saved : p)));
        return saved;
      } catch (err: any) {
        console.error('Failed to update practice entry:', formatSupabaseError(err), err);
        if (err.code === 'PGRST116' || err.message?.includes('no longer exists')) {
          setPracticeEntries((prev) => prev.filter((p) => p.id !== entry.id));
          const fresh = await fetchPracticeEntries().catch(() => []);
          setPracticeEntries(fresh);
          alert('Practice no longer exists or could not be accessed.');
          throw err;
        }
        const fresh = await fetchPracticeEntries().catch(() => []);
        setPracticeEntries(fresh);
        alert('Unable to save practice: ' + (err.message || 'Database error'));
        throw err;
      }
    }
  };

  const handleDeletePracticeEntry = async (id: string) => {
    if (!requirePermission('delete')) return;
    const target = practiceEntries.find((p) => p.id === id);
    setPracticeEntries((prev) => prev.filter((p) => p.id !== id));
    try {
      await supabaseDeletePracticeEntry(id, target?.revision || 1);
    } catch (err: any) {
      console.error('Failed to delete practice entry:', formatSupabaseError(err), err);
      const fresh = await fetchPracticeEntries().catch(() => []);
      setPracticeEntries(fresh);
      alert('Unable to delete practice: ' + (err.message || 'Database error'));
    }
  };

  const handleSavePracticeVocalPart = async (
    practiceId: string,
    part: import('./types').PracticePartTrack,
    position?: number
  ) => {
    if (!requirePermission('upload')) {
      throw new Error('Your account does not have UPLOAD permission.');
    }
    const savedPart = await supabaseSavePracticeVocalPart(practiceId, part, position);
    setPracticeEntries((entries) => entries.map((entry) => {
      if (entry.id !== practiceId) return entry;
      const parts = [...(entry.vocalParts?.length ? entry.vocalParts : entry.parts || [])];
      const index = parts.findIndex((item) => item.id === savedPart.id);
      if (index >= 0) parts[index] = savedPart;
      else parts.push(savedPart);
      parts.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      return { ...entry, vocalParts: parts, parts };
    }));
    // Persistence is complete. A refresh must never turn it into a failed save.
    void fetchPracticeEntries().then(setPracticeEntries).catch((error) => {
      console.warn('Vocal part saved, but practice refresh failed:', error);
    });
    return savedPart;
  };

  const handleDeletePracticeVocalPart = async (part: import('./types').PracticePartTrack) => {
    if (!requirePermission('delete')) return;
    if (!part.id || !isUUID(part.id)) return;
    await executeSoftDelete('vocal_parts', part.id, part.revision || 1);
    const fresh = await fetchPracticeEntries();
    setPracticeEntries(fresh);
  };

  const handleSavePracticeTrack = async (
    practiceId: string,
    attachment: import('./types').SongAttachment,
    position?: number
  ) => {
    if (!requirePermission('upload')) {
      throw new Error('Your account does not have UPLOAD permission.');
    }
    const saved = await supabaseSavePracticeAttachment(practiceId, attachment, position);
    const fresh = await fetchPracticeEntries();
    setPracticeEntries(fresh);
    return saved;
  };

  const handleDeletePracticeTrack = async (attachment: import('./types').SongAttachment) => {
    if (!requirePermission('delete')) return;
    if (!attachment.id || !isUUID(attachment.id)) return;
    await executeSoftDelete('attachments', attachment.id, attachment.revision || 1);
    const fresh = await fetchPracticeEntries();
    setPracticeEntries(fresh);
  };

  // Celebrant & Recognitions Operations
  const handleSaveBirthday = async (item: BirthdayCelebrant) => {
    const isNew = !birthdays.some((existing) => existing.id === item.id);
    if (!requirePermission(isNew ? 'add' : 'edit')) return;

    try {
      const saved = await supabaseSaveBirthday(item, isNew);
      setBirthdays((prev) =>
        isNew
          ? [...prev.filter((existing) => existing.id !== item.id && existing.id !== saved.id), saved]
          : prev.map((existing) => (existing.id === item.id ? saved : existing))
      );
    } catch (err: any) {
      console.error('Failed to save birthday celebrant:', err);
      const fresh = await fetchBirthdays().catch(() => []);
      setBirthdays(fresh);
      alert('Unable to save celebrant: ' + (err.message || 'Database error'));
    }
  };

  const handleDeleteBirthday = async (id: string) => {
    if (!requirePermission('delete')) return;
    const target = birthdays.find((b) => b.id === id);
    setBirthdays((prev) => prev.filter((b) => b.id !== id));
    try {
      await supabaseDeleteBirthday(id, target?.revision || 1);
    } catch (err: any) {
      console.error('Failed to delete celebrant:', err);
      const fresh = await fetchBirthdays().catch(() => []);
      setBirthdays(fresh);
    }
  };

  const handleSaveAnniversary = async (item: AnniversaryCelebrant) => {
    const isNew = !anniversaries.some((existing) => existing.id === item.id);
    if (!requirePermission(isNew ? 'add' : 'edit')) return;

    try {
      const saved = await supabaseSaveAnniversary(item, isNew);
      setAnniversaries((prev) =>
        isNew
          ? [...prev.filter((existing) => existing.id !== item.id && existing.id !== saved.id), saved]
          : prev.map((existing) => (existing.id === item.id ? saved : existing))
      );
    } catch (err: any) {
      console.error('Failed to save anniversary:', err);
      const fresh = await fetchAnniversaries().catch(() => []);
      setAnniversaries(fresh);
      alert('Unable to save anniversary: ' + (err.message || 'Database error'));
    }
  };

  const handleDeleteAnniversary = async (id: string) => {
    if (!requirePermission('delete')) return;
    const target = anniversaries.find((a) => a.id === id);
    setAnniversaries((prev) => prev.filter((a) => a.id !== id));
    try {
      await supabaseDeleteAnniversary(id, target?.revision || 1);
    } catch (err: any) {
      console.error('Failed to delete anniversary:', err);
      const fresh = await fetchAnniversaries().catch(() => []);
      setAnniversaries(fresh);
    }
  };

  const handleSaveVisitor = async (item: Visitor) => {
    const isNew = !visitors.some((existing) => existing.id === item.id);
    if (!requirePermission(isNew ? 'add' : 'edit')) return;

    try {
      const saved = await supabaseSaveVisitor(item, isNew);
      setVisitors((prev) =>
        isNew
          ? [saved, ...prev.filter((existing) => existing.id !== item.id && existing.id !== saved.id)]
          : prev.map((existing) => (existing.id === item.id ? saved : existing))
      );
    } catch (err: any) {
      console.error('Failed to save visitor:', err);
      const fresh = await fetchVisitors().catch(() => []);
      setVisitors(fresh);
      alert('Unable to save visitor: ' + (err.message || 'Database error'));
    }
  };

  const handleDeleteVisitor = async (id: string) => {
    if (!requirePermission('delete')) return;
    const target = visitors.find((v) => v.id === id);
    setVisitors((prev) => prev.filter((v) => v.id !== id));
    try {
      await supabaseDeleteVisitor(id, target?.revision || 1);
    } catch (err: any) {
      console.error('Failed to delete visitor:', err);
      const fresh = await fetchVisitors().catch(() => []);
      setVisitors(fresh);
    }
  };

  const handleSaveSpecialRecognition = async (item: SpecialRecognition) => {
    const isNew = !specialRecognitions.some((existing) => existing.id === item.id);
    if (!requirePermission(isNew ? 'add' : 'edit')) return;

    try {
      const saved = await supabaseSaveSpecialRecognition(item, isNew);
      setSpecialRecognitions((prev) =>
        isNew
          ? [saved, ...prev.filter((existing) => existing.id !== item.id && existing.id !== saved.id)]
          : prev.map((existing) => (existing.id === item.id ? saved : existing))
      );
    } catch (err: any) {
      console.error('Failed to save recognition:', err);
      const fresh = await fetchSpecialRecognitions().catch(() => []);
      setSpecialRecognitions(fresh);
      alert('Unable to save recognition: ' + (err.message || 'Database error'));
    }
  };

  const handleDeleteSpecialRecognition = async (id: string) => {
    if (!requirePermission('delete')) return;
    const target = specialRecognitions.find((r) => r.id === id);
    setSpecialRecognitions((prev) => prev.filter((r) => r.id !== id));
    try {
      await supabaseDeleteSpecialRecognition(id, target?.revision || 1);
    } catch (err: any) {
      console.error('Failed to delete recognition:', err);
      const fresh = await fetchSpecialRecognitions().catch(() => []);
      setSpecialRecognitions(fresh);
    }
  };

  // Cross-Navigation Helpers
  const handleOpenSongDetail = (songId: string, returnSetlistId?: string) => {
    returnSetlistIdRef.current = returnSetlistId || null;
    setSelectedSongIdForTab(songId);
    setSongNavigationTrigger({ songId, timestamp: Date.now() });
    handleNavigateTab('songs');
  };

  const handleAddSongToNewSetlist = (song: Song) => {
    const nextSunday = getNextSundayStr();
    const newSetlist: Setlist = {
      id: generateUUID(),
      type: 'sunday',
      date: nextSunday,
      presider: 'TBA',
      welcomeSong: 'Napakaligaya',
      closingSong: 'Give Thanks',
      sundaySchool: {
        songLeader: 'TBA',
        songs: [
          { id: generateUUID(), title: 'Opening Song' },
          { id: generateUUID(), title: 'Response Song' },
        ],
      },
      worshipService: {
        songLeader: 'TBA',
        songs: [
          { id: generateUUID(), songId: isUUID(song.id) ? song.id : undefined, title: song.title },
          { id: generateUUID(), title: 'Song 2' },
          { id: generateUUID(), title: 'Song 3' },
        ],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      revision: 1,
    };

    handleSaveSetlist(newSetlist);
    handleNavigateTab('home');
  };

  const handleAddSongToExistingUpcomingSetlist = (
    song: Song,
    targetSetlistId: string,
    part: 'sundaySchool' | 'worshipService'
  ) => {
    const targetSetlist = setlists.find((s) => s.id === targetSetlistId);
    if (!targetSetlist) return;

    const currentPart = targetSetlist[part] || { songLeader: '', songs: [] };
    const newItem: SetlistSongItem = {
      id: generateUUID(),
      songId: isUUID(song.id) ? song.id : undefined,
      title: song.title,
    };

    const updatedPartSongs = [...(currentPart.songs || []), newItem];

    const updatedSetlist: Setlist = {
      ...targetSetlist,
      [part]: {
        ...currentPart,
        songs: updatedPartSongs,
      },
      updatedAt: new Date().toISOString(),
    };

    handleSaveSetlist(updatedSetlist);
  };

  // Directory saved names
  const handleUpdateSavedNames = async (names: string[]) => {
    setSavedNames(names);
    await supabaseSaveMinistrySavedNames(names).catch(console.error);
  };

  // Badge calculations
  const { currentWindow: thisWeekBirthdays } = categorizeAnnualCelebrants<BirthdayCelebrant>(
    birthdays,
    (b: BirthdayCelebrant) => b.birthDate
  );
  const { currentWindow: thisWeekAnniversaries } = categorizeAnnualCelebrants<AnniversaryCelebrant>(
    anniversaries,
    (a: AnniversaryCelebrant) => a.anniversaryDate
  );
  const totalCelebrantsThisWeek = thisWeekBirthdays.length + thisWeekAnniversaries.length;
  const upcomingSpecialCount = specialNumbers.filter((s) => !isPastDate(s.scheduledDate)).length;

  // Requirement 2: Show loading/skeleton screen until Supabase authentication and the first authoritative query finish.
  // Do not render stale shared records during startup.
  if (isLoadingInitialData) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-800 dark:text-slate-100 transition-colors">
        <div className="w-full max-w-sm flex flex-col items-center text-center space-y-6 animate-pulse">
          <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-2 flex items-center justify-center">
            <ChurchLogo className="w-full h-full object-contain" />
          </div>
          <div className="space-y-2">
            <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              New Life Baptist Church
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Connecting to church sanctuary portal & music library...
            </p>
          </div>
          <div className="w-full space-y-3 pt-2">
            <div className="h-10 bg-slate-200 dark:bg-slate-800/60 rounded-xl w-full" />
            <div className="h-28 bg-slate-200/80 dark:bg-slate-800/40 rounded-2xl w-full" />
            <div className="h-20 bg-slate-200/60 dark:bg-slate-800/30 rounded-2xl w-full" />
          </div>
        </div>
      </div>
    );
  }

  // Unauthenticated Gate
  if (!currentUser) {
    return <AuthScreen onSignInSuccess={handleSignInSuccess} />;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors">
      {/* Sticky Top Header */}
      <Navbar
        currentUser={currentUser}
        users={users}
        currentTab={currentTab}
        onNavigateToSettings={() => handleNavigateTab('settings')}
        databaseStatus={dbStatus}
        onOpenFirestoreStatusModal={() => setIsStatusModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-3.5 sm:px-6 py-5 pb-28">
        <div className={currentTab === 'home' ? 'block' : 'hidden'}>
          <SetlistsTab
            setlists={setlists}
            songs={songs}
            savedNames={savedNames}
            onSaveSetlist={handleSaveSetlist}
            onDeleteSetlist={handleDeleteSetlist}
            onOpenSongDetail={handleOpenSongDetail}
            onSubViewChange={(hasActive) => {
              hasActiveSubViewRef.current = hasActive;
            }}
            initialSelectedSetlistId={initialSelectedSetlistId}
            collapseSignal={collapseSignals.home}
          />
        </div>

        <div className={currentTab === 'recognitions' ? 'block' : 'hidden'}>
          <RecognitionsTab
            birthdays={birthdays}
            anniversaries={anniversaries}
            visitors={visitors}
            specialRecognitions={specialRecognitions}
            onSaveBirthday={handleSaveBirthday}
            onDeleteBirthday={handleDeleteBirthday}
            onSaveAnniversary={handleSaveAnniversary}
            onDeleteAnniversary={handleDeleteAnniversary}
            onSaveVisitor={handleSaveVisitor}
            onDeleteVisitor={handleDeleteVisitor}
            onSaveSpecialRecognition={handleSaveSpecialRecognition}
            onDeleteSpecialRecognition={handleDeleteSpecialRecognition}
            collapseSignal={collapseSignals.recognitions}
          />
        </div>

        <div className={currentTab === 'special-numbers' ? 'block' : 'hidden'}>
          <SpecialNumberTab
            specialNumbers={specialNumbers}
            practiceEntries={practiceEntries}
            choirEntries={choirEntries}
            songs={songs}
            setlists={setlists}
            savedNames={savedNames}
            onSaveSpecialNumber={handleSaveSpecialNumber}
            onDeleteSpecialNumber={handleDeleteSpecialNumber}
            onSavePracticeEntry={handleSavePracticeEntry}
            onSavePracticeVocalPart={handleSavePracticeVocalPart}
            onDeletePracticeVocalPart={handleDeletePracticeVocalPart}
            onSavePracticeTrack={handleSavePracticeTrack}
            onDeletePracticeTrack={handleDeletePracticeTrack}
            onDeletePracticeEntry={handleDeletePracticeEntry}
            onSaveChoirEntry={handleSaveChoirEntry}
            onDeleteChoirEntry={handleDeleteChoirEntry}
            onOpenSongDetail={handleOpenSongDetail}
            onSaveSong={handleSaveSong}
            collapseSignal={collapseSignals['special-numbers']}
          />
        </div>

        <div className={currentTab === 'songs' ? 'block' : 'hidden'}>
          <SongsTab
            songs={songs}
            setlists={setlists}
            onSaveSong={handleSaveSong}
            onBatchSaveSongs={handleBatchSaveSongs}
            onDeleteSong={handleDeleteSong}
            onAddSongToNewSetlist={handleAddSongToNewSetlist}
            onAddSongToExistingUpcomingSetlist={handleAddSongToExistingUpcomingSetlist}
            initialSelectedSongId={selectedSongIdForTab}
            songNavigationTrigger={songNavigationTrigger}
            onClearInitialSelectedSongId={() => setSelectedSongIdForTab(null)}
            collapseSignal={collapseSignals.songs}
          />
        </div>

        <div className={currentTab === 'settings' ? 'block' : 'hidden'}>
          <SettingsTab
            currentUser={currentUser}
            onUpdateCurrentUser={setCurrentUser}
            users={users}
            onUpdateUsers={setUsers}
            savedNames={savedNames}
            onUpdateSavedNames={handleUpdateSavedNames}
            theme={theme}
            onToggleTheme={handleToggleTheme}
            onSignOut={handleSignOut}
            onDataReset={reloadAllData}
            databaseStatus={dbStatus}
            onOpenDatabaseStatusModal={() => setIsStatusModalOpen(true)}
            appData={{
              songs,
              setlists,
              specialNumbers,
              practiceEntries,
              choirEntries,
              birthdays,
              anniversaries,
              visitors,
              specialRecognitions,
              savedNames,
              welcomeSongs: loadWelcomeSongs(),
            }}
          />
        </div>
      </main>

      {/* Mobile-First Bottom Navigation */}
      <BottomNav
        activeTab={currentTab}
        onChangeTab={handleNavigateTab}
        celebrantCount={totalCelebrantsThisWeek}
        upcomingSpecialCount={upcomingSpecialCount}
      />

      {/* Database Realtime Timestamps & Connection Status Modal */}
      <FirestoreStatusModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        statusInfo={dbStatus}
      />

      {/* Logout Confirmation Prompt on back swipe from Home */}
      {showLogoutConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Exit & Sign Out?
                </h3>
              </div>
              <button
                onClick={() => setShowLogoutConfirmModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              You are currently on the Home tab. Pressing or swiping back again will close your session. Would you like to sign out of the church ministry app?
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setShowLogoutConfirmModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel / Stay
              </button>
              <button
                onClick={handleSignOut}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
