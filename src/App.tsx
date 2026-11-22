import { usePullToRefresh, refreshLocalScreens } from './hooks/usePullToRefresh';
import { PullToRefreshIndicator } from './components/PullToRefreshIndicator';
import { songTitleCase } from './utils/songTitleCase';
import { showAppMessage } from './services/appDialogs';
import { useAppExitGuard } from './hooks/useAppExitGuard';
import { ExitConfirmation } from './components/ExitConfirmation';
import { useAssignmentNotifications } from './hooks/useAssignmentNotifications';
import { useDirectoryAvatars } from './hooks/useDirectoryAvatars';
import { NotificationInbox } from './components/NotificationInbox';
import { disableAssignmentPush, requestInitialPushPermission } from './services/assignmentNotifications';
import { SwipeNavigationProvider } from './components/SwipeNavigation';
import { readSetlistShareId } from './utils/setlistSharing';
import { songResolver, linkSetlist, linkSongEntry, linkPracticeEntry } from './utils/linkedSongs';
import { initialAppTab } from './utils/tabNavigation';
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import type { SermonOutline } from './features/sermons/model';
import type { SongNavigationRequest } from './utils/songMediaNavigation';
import { isBackLayerMounted, useBackLayer } from './hooks/useBackLayer';
import React, { lazy, Suspense, useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  ScheduleSongSaveOptions,
  ChoirEntry,
  DatabaseStatusInfo,
} from './types';
import { clearDeviceAuthSession, supabase } from './supabase';
import { fetchActivities } from './features/activities/data';
import { androidSignedOut, clearOfflineLibrary, isAndroidOfflineLibrary, readOfflineLibrary, setAndroidSignedOut, writeOfflineLibrary, type OfflineLibrary } from './services/androidOfflineLibrary';
import {
  fetchSetlists,
  saveSetlist as supabaseSaveSetlist,
  saveSetlistOrder as supabaseSaveSetlistOrder,
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
import { getNextSundayStr } from './utils/dateUtils';
import { Navbar } from './components/Navbar';
import { loadAppFont, applyAppFont, type AppFont } from './utils/appFont';
import { HeaderSearchProvider } from './components/HeaderSearch';
import { BottomNav } from './components/BottomNav';
import { AuthScreen } from './components/AuthScreen';
import { FirestoreStatusModal } from './components/FirestoreStatusModal';
import { ChurchLogo } from './components/ChurchLogo';
import { X, CloudOff, Users } from 'lucide-react';

// Execute legacy storage purge immediately before any component lifecycle
cleanupLegacyStorage();

const SetlistsTab = lazy(() => import('./components/SetlistsTab').then((module) => ({ default: module.SetlistsTab })));
const RecognitionsTab = lazy(() => import('./components/RecognitionsTab').then((module) => ({ default: module.RecognitionsTab })));
const SpecialNumberTab = lazy(() => import('./components/SpecialNumberTab').then((module) => ({ default: module.SpecialNumberTab })));
const SongsTab = lazy(() => import('./components/SongsTab').then((module) => ({ default: module.SongsTab })));
const SermonOutlines = React.lazy(() => import('./features/sermons/SermonOutlines'));
const Notepad = React.lazy(() => import('./features/notepad/Notepad'));
const SettingsTab = lazy(() => import('./components/SettingsTab').then((module) => ({ default: module.SettingsTab })));

function TabLoadingSkeleton() {
  return (
    <div role="status" aria-label="Loading section" className="space-y-3 animate-pulse">
      <div className="h-10 rounded-xl bg-slate-200/80 dark:bg-slate-800" />
      <div className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-900" />
      <div className="h-20 rounded-2xl bg-slate-100 dark:bg-slate-900" />
    </div>
  );
}

export default function App() {
  useEffect(() => { void requestInitialPushPermission().catch(() => {}); }, []);
  // 1. Auth and Loading States
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const currentAccountRef = useRef(currentUser);
  currentAccountRef.current = currentUser;
  const signedInUserIdRef = useRef<string | null>(null);
  signedInUserIdRef.current = currentUser?.id || null;
  const [users, setUsers] = useState<UserAccount[]>([]);
  const directoryAvatars = useDirectoryAvatars(currentUser?.id);
  const [isLoadingInitialData, setIsLoadingInitialData] = useState<boolean>(true);
  const [isLoadingCoreData, setIsLoadingCoreData] = useState(true);
  const coreLoadEpoch = useRef(0);
  const [offlineReadOnly, setOfflineReadOnly] = useState(false);
  const [offlineLibrary, setOfflineLibrary] = useState<OfflineLibrary | null>(null);
  const offlineText = offlineLibrary?.text;
  const offlineReadOnlyRef = useRef(false);
  const setReadOnly = useCallback((value: boolean) => {
    offlineReadOnlyRef.current = value;
    setOfflineReadOnly(value);
  }, []);
  const signingOutRef = useRef(androidSignedOut());

  // Connection Status
  const [dbStatus, setDbStatus] = useState<DatabaseStatusInfo>(() =>
    getDatabaseConnectionStatus()
  );
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  // 2. Personal Display Preferences (Preserved)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => loadTheme());
  const [appFont, setAppFont] = useState<AppFont>(loadAppFont);
  useEffect(() => { applyAppFont(appFont); }, [appFont]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    if (Capacitor.isNativePlatform()) void SystemBars.setStyle({ style: theme === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {});
    saveTheme(theme);
    try { localStorage.removeItem('qnlbc_color_theme'); } catch {}
  }, [theme]);

  // Active Tab & Browser Navigation (Preserved)
  const [currentTab, setCurrentTab] = useState<AppTab>(() => readSetlistShareId(window.location.href, window.location.href) ? 'home' : initialAppTab(window.location.hash));

  const exitGuard = useAppExitGuard(currentTab, () => setCurrentTab('special-numbers'));
  const [isSettingsSectionOpen, setIsSettingsSectionOpen] = useState(false);
  const hideMainHeader = currentTab === 'settings' && isSettingsSectionOpen;

  const tabHistoryRef = useRef<AppTab[]>([currentTab]);
  const hasActiveSubViewRef = useRef(false);
  const [collapseSignals, setCollapseSignals] = useState<Record<string, number>>({});
  const [isPracticeDetailOpen, setIsPracticeDetailOpen] = useState(false);
  const [practiceCloseSignal, setPracticeCloseSignal] = useState(0);

  const handlePracticeDetailChange = useCallback((isOpen: boolean) => {
    setIsPracticeDetailOpen(isOpen);
    hasActiveSubViewRef.current = isOpen;
  }, []);



  // Deep linking and navigation helpers
  const [selectedSongIdForTab, setSelectedSongIdForTab] = useState<string | null>(null);
  const [songNavigationTrigger, setSongNavigationTrigger] = useState<SongNavigationRequest | null>(null);
  const pendingSharedSetlist = useRef(readSetlistShareId(window.location.href, window.location.href));
  const [sharedLinkRequest, setSharedLinkRequest] = useState(0);
  const [sharedSetlistError, setSharedSetlistError] = useState('');
  const [initialSelectedSetlistId, setInitialSelectedSetlistId] = useState<string | null>(() => pendingSharedSetlist.current);
  // In-memory only: retained between tabs, reset by reload/reopening the app.
  const rememberedSetlists = useRef<{ ids: string[] } | null>(null);
  const outlineCache = useRef<{ userId: string; rows: SermonOutline[] } | null>(null);
  const [nativeSplashVisible, setNativeSplashVisible] = useState(() => Capacitor.isNativePlatform());
  useEffect(() => {
    if ((isLoadingInitialData && !exitGuard.isOpen) || !nativeSplashVisible) return;
    // Also reveal an exit prompt requested while the native launch splash is up.
    void SplashScreen.hide().catch(error => console.warn('Unable to hide launch splash', error))
      .finally(() => setNativeSplashVisible(false));
  }, [isLoadingInitialData, nativeSplashVisible, exitGuard.isOpen]);
  useEffect(() => {
    if (outlineCache.current?.userId !== currentUser?.id) outlineCache.current = null;
  }, [currentUser?.id]);
  const returnSetlistIdRef = useRef<string | null>(null);
  const savedSetlistScrollPosRef = useRef<{ setlistId: string; scrollY: number } | null>(null);
  const [setlistJourney, setSetlistJourney] = useState<{ setlistId: string; scrollY: number } | null>(null);
  useEffect(() => {
    try {
      sessionStorage.removeItem('nlbc_saved_setlist_id');
      sessionStorage.removeItem('nlbc_saved_setlist_scroll_y');
    } catch {}
  }, []);

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
  const resolveLibrarySong = useMemo(() => songResolver(songs), [songs]);
  const linkedSetlists = useMemo(() => setlists.map(entry => linkSetlist(entry, resolveLibrarySong)), [setlists, resolveLibrarySong]);
  const linkedSpecialNumbers = useMemo(() => (offlineReadOnly ? offlineText?.songNumbers ?? [] : specialNumbers).map(entry => linkSongEntry(entry, resolveLibrarySong)), [offlineReadOnly, offlineText, specialNumbers, resolveLibrarySong]);
  const linkedChoirEntries = useMemo(() => (offlineReadOnly ? offlineText?.choir ?? [] : choirEntries).map(entry => linkSongEntry(entry, resolveLibrarySong)), [offlineReadOnly, offlineText, choirEntries, resolveLibrarySong]);
  const linkedPracticeEntries = useMemo(() => (offlineReadOnly ? offlineText?.practice ?? [] : practiceEntries).map(entry => linkPracticeEntry(entry, resolveLibrarySong)), [offlineReadOnly, offlineText, practiceEntries, resolveLibrarySong]);

  const [savedNames, setSavedNames] = useState<string[]>([]);
  const [refreshError, setRefreshError] = useState('');
  const lastLoadedData = useRef({ setlists, songs, birthdays, anniversaries, visitors, specialRecognitions, specialNumbers, choirEntries, practiceEntries, savedNames, users });
  lastLoadedData.current = { setlists, songs, birthdays, anniversaries, visitors, specialRecognitions, specialNumbers, choirEntries, practiceEntries, savedNames, users };
  const preserveOnRefreshFailure = <K extends keyof typeof lastLoadedData.current>(key: K) => {
    setRefreshError('Unable to refresh. Showing the last loaded data.');
    return lastLoadedData.current[key];
  };
  const loadedSectionsRef = useRef<Set<AppTab>>(new Set());
  const sectionLoadPromisesRef = useRef<Partial<Record<AppTab, Promise<void>>>>({});
  const snapshotTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(snapshotTimer.current), []);
  const scheduleOfflineSync = () => {
    if (!isAndroidOfflineLibrary() || offlineReadOnlyRef.current || signingOutRef.current) return;
    const account = currentAccountRef.current;
    if (!account) return;
    window.clearTimeout(snapshotTimer.current);
    snapshotTimer.current = window.setTimeout(async () => {
      if (offlineReadOnlyRef.current || signedInUserIdRef.current !== account.id || signingOutRef.current) return;
      const epoch = coreLoadEpoch.current;
      try {
        const [latestSongs, latestSetlists, activities] = await Promise.all([fetchSongs(), fetchSetlists(), fetchActivities()]);
        if (epoch !== coreLoadEpoch.current || signedInUserIdRef.current !== account.id || offlineReadOnlyRef.current || signingOutRef.current) return;
        await writeOfflineLibrary(account, latestSongs, latestSetlists, activities, () => epoch === coreLoadEpoch.current && signedInUserIdRef.current === account.id && !offlineReadOnlyRef.current && !signingOutRef.current);
      } catch (error) {
        console.warn('Offline library sync failed', error);
      }
    }, 1000);
  };

  const loadCoreData = useCallback(async (profile?: UserAccount, keepVisible = false) => {
    const own = ++coreLoadEpoch.current;
    if (!keepVisible) setIsLoadingCoreData(true);
    let complete = true;
    const [serverSetlists, serverSongs, serverSavedNames] = await Promise.all([
      fetchSetlists().catch(() => { complete = false; return preserveOnRefreshFailure('setlists'); }),
      fetchSongs().catch(() => { complete = false; return preserveOnRefreshFailure('songs'); }),
      fetchMinistrySavedNames().catch(() => preserveOnRefreshFailure('savedNames')),
    ]);
    if (own !== coreLoadEpoch.current) return;
    setSetlists(serverSetlists);
    setSongs(serverSongs);
    setSavedNames(serverSavedNames);
    loadedSectionsRef.current.add('home');
    loadedSectionsRef.current.add('songs');
    setIsLoadingCoreData(false);
    if (profile && complete && isAndroidOfflineLibrary()) {
      void fetchActivities().then(async activities => {
        if (own !== coreLoadEpoch.current || signingOutRef.current || offlineReadOnlyRef.current) return;
        await writeOfflineLibrary(profile, serverSongs, serverSetlists, activities, () => own === coreLoadEpoch.current && !signingOutRef.current && !offlineReadOnlyRef.current);
      }).catch(error => console.warn('Offline library sync failed', error));
    }
  }, []);

  const loadTabData = useCallback((tab: AppTab): Promise<void> => {
    if (loadedSectionsRef.current.has(tab)) return Promise.resolve();
    const existing = sectionLoadPromisesRef.current[tab];
    if (existing) return existing;

    const request = (async () => {
      if (tab === 'recognitions') {
        const [bday, anniv, visitorRows, recognitionRows] = await Promise.all([
          fetchBirthdays().catch(() => preserveOnRefreshFailure('birthdays')),
          fetchAnniversaries().catch(() => preserveOnRefreshFailure('anniversaries')),
          fetchVisitors().catch(() => preserveOnRefreshFailure('visitors')),
          fetchSpecialRecognitions().catch(() => preserveOnRefreshFailure('specialRecognitions')),
        ]);
        setBirthdays(bday);
        setAnniversaries(anniv);
        setVisitors(visitorRows);
        setSpecialRecognitions(recognitionRows);
      } else if (tab === 'special-numbers') {
        const [specialRows, choirRows, practiceRows] = await Promise.all([
          fetchSpecialNumbers().catch(() => preserveOnRefreshFailure('specialNumbers')),
          fetchChoirEntries().catch(() => preserveOnRefreshFailure('choirEntries')),
          fetchPracticeEntries().catch(() => preserveOnRefreshFailure('practiceEntries')),
        ]);
        setSpecialNumbers(specialRows);
        setChoirEntries(choirRows);
        setPracticeEntries(practiceRows);
      } else if (tab === 'settings') {
        setUsers(await fetchAllProfiles().catch(() => preserveOnRefreshFailure('users')));
      }
      loadedSectionsRef.current.add(tab);
    })().finally(() => {
      delete sectionLoadPromisesRef.current[tab];
    });
    sectionLoadPromisesRef.current[tab] = request;
    return request;
  }, []);

  const loadCalendarBirthdays = useCallback(() => loadTabData('recognitions'), [loadTabData]);

  // 4. Initial Authoritative Load and Session Management
  useEffect(() => {
    let isMounted = true;
    let authCheck = 0;
    cleanupLegacyStorage();

    const android = isAndroidOfflineLibrary();
    const restoreOffline = async (expectedUserId?: string, finishLoading = true) => {
      const check = authCheck;
      setReadOnly(true);
      const snapshot = await readOfflineLibrary();
      if (!isMounted || check !== authCheck || signingOutRef.current || !offlineReadOnlyRef.current) return;
      if (snapshot && (!expectedUserId || snapshot.user.id === expectedUserId)) {
        if (!signedInUserIdRef.current) {
          setCurrentUser({ ...snapshot.user, role: 'user', active: true });
          setSetlists(snapshot.setlists);
          setSongs(snapshot.songs);
        }
        setOfflineLibrary(snapshot);
      } else {
        setOfflineLibrary(null);
        if (!finishLoading) return;
      }
      setIsLoadingCoreData(false);
      setIsLoadingInitialData(false);
    };

    async function initSessionAndData() {
      const check = ++authCheck;
      if (signingOutRef.current) { setIsLoadingInitialData(false); return; }
      if (android && !window.navigator.onLine) {
        await restoreOffline(signedInUserIdRef.current || undefined);
        return;
      }
      let userId: string | undefined;
      try {
        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
        if (!isMounted || check !== authCheck || signingOutRef.current) return;
        if (android && sessionErr && (!sessionErr.status || sessionErr.status >= 500 || sessionErr.status === 429)) throw sessionErr;
        if (sessionErr || !sessionData?.session?.user) {
          if (android) await clearOfflineLibrary();
          if (isMounted) {
            setCurrentUser(null);
            setIsLoadingInitialData(false);
          }
          return;
        }

        userId = sessionData.session.user.id;
        const profile = await fetchCurrentUserProfile(userId, android);
        if (!isMounted || check !== authCheck || signingOutRef.current) return;

        if (!profile || !profile.active) {
          if (android) await clearOfflineLibrary();
          setNotificationInboxOpen(false);
          await disableAssignmentPush().catch(error => console.warn(error.message));
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

        // Load only the shared data required by the primary Setlists and Songs views.
        // Secondary sections fetch their authoritative data when first opened.
        if (isMounted) {
          const keepVisible = Boolean(signedInUserIdRef.current === profile.id);
          if (offlineReadOnlyRef.current) {
            loadedSectionsRef.current.delete('recognitions');
            loadedSectionsRef.current.delete('special-numbers');
          }
          setReadOnly(false);
          setRefreshError('');
          setIsLoadingInitialData(false);
          void loadCoreData(profile, keepVisible);
        }
      } catch (err) {
        console.error('Failed to initialize authoritative data:', err);
        if (android && isMounted && check === authCheck && !signingOutRef.current) {
          await restoreOffline(userId || signedInUserIdRef.current || undefined);
          return;
        }
        if (isMounted) {
          setIsLoadingInitialData(false);
        }
      }
    }

    if (android && !signingOutRef.current && window.navigator.onLine) {
      void restoreOffline(undefined, false).then(() => { if (isMounted) void initSessionAndData(); });
    } else {
      void initSessionAndData();
    }
    const goOffline = () => {
      authCheck++;
      coreLoadEpoch.current++;
      void restoreOffline(signedInUserIdRef.current || undefined);
    };
    const reconnect = () => { if (document.visibilityState === 'visible') void initSessionAndData(); };
    const retry = android ? window.setInterval(() => {
      if (offlineReadOnlyRef.current && window.navigator.onLine && document.visibilityState === 'visible') reconnect();
    }, 30_000) : undefined;
    if (android) {
      window.addEventListener('offline', goOffline);
      window.addEventListener('online', reconnect);
      document.addEventListener('visibilitychange', reconnect);
    }

    // Listen to Supabase Auth changes
    const { data: authSub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (!android && !session)) {
        if (isMounted) {
          authCheck++;
          coreLoadEpoch.current++;
          if (android) void clearOfflineLibrary().catch(console.warn);
          setIsLoadingCoreData(false);
          loadedSectionsRef.current.clear();
          sectionLoadPromisesRef.current = {};
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
      } else if (event === 'SIGNED_IN' && session && !offlineReadOnlyRef.current && !signingOutRef.current) {
        // Auth callbacks run under Supabase's session lock; defer database calls.
        window.setTimeout(() => { void (async () => {
          const epoch = coreLoadEpoch.current;
          const { data } = await supabase.auth.getSession();
          if (!isMounted || data.session?.user.id !== session.user.id) return;
          const profile = await fetchCurrentUserProfile(session.user.id);
          if (isMounted && epoch === coreLoadEpoch.current && profile?.active) setCurrentUser(profile);
        })().catch(() => {}); }, 0);
      }
    });

    // Realtime changes listener
    const unsubRealtime = subscribeSupabaseRealtime({
      onSetlistsChange: async () => {
        if (offlineReadOnlyRef.current || signingOutRef.current) return;
        const fresh = await fetchSetlists().catch(() => preserveOnRefreshFailure('setlists'));
        if (isMounted && !offlineReadOnlyRef.current && !signingOutRef.current) { setSetlists(fresh); scheduleOfflineSync(); }
      },
      onSongsChange: async () => {
        if (offlineReadOnlyRef.current || signingOutRef.current) return;
        const fresh = await fetchSongs().catch(() => preserveOnRefreshFailure('songs'));
        if (isMounted && !offlineReadOnlyRef.current && !signingOutRef.current) { setSongs(fresh); scheduleOfflineSync(); }
      },
      onSpecialNumbersChange: async () => {
        scheduleOfflineSync();
        if (!loadedSectionsRef.current.has('special-numbers')) return;
        const fresh = await fetchSpecialNumbers().catch(() => preserveOnRefreshFailure('specialNumbers'));
        if (isMounted) setSpecialNumbers(fresh);
      },
      onChoirChange: async () => {
        scheduleOfflineSync();
        if (!loadedSectionsRef.current.has('special-numbers')) return;
        const fresh = await fetchChoirEntries().catch(() => preserveOnRefreshFailure('choirEntries'));
        if (isMounted) setChoirEntries(fresh);
      },
      onPracticeChange: async () => {
        scheduleOfflineSync();
        if (!loadedSectionsRef.current.has('special-numbers')) return;
        const fresh = await fetchPracticeEntries().catch(() => preserveOnRefreshFailure('practiceEntries'));
        if (isMounted) setPracticeEntries(fresh);
      },
      onBirthdaysChange: async () => {
        scheduleOfflineSync();
        if (!loadedSectionsRef.current.has('recognitions')) return;
        const fresh = await fetchBirthdays().catch(() => preserveOnRefreshFailure('birthdays'));
        if (isMounted) setBirthdays(fresh);
      },
      onAnniversariesChange: async () => {
        scheduleOfflineSync();
        if (!loadedSectionsRef.current.has('recognitions')) return;
        const fresh = await fetchAnniversaries().catch(() => preserveOnRefreshFailure('anniversaries'));
        if (isMounted) setAnniversaries(fresh);
      },
      onVisitorsChange: async () => {
        scheduleOfflineSync();
        if (!loadedSectionsRef.current.has('recognitions')) return;
        const fresh = await fetchVisitors().catch(() => preserveOnRefreshFailure('visitors'));
        if (isMounted) setVisitors(fresh);
      },
      onRecognitionsChange: async () => {
        scheduleOfflineSync();
        if (!loadedSectionsRef.current.has('recognitions')) return;
        const fresh = await fetchSpecialRecognitions().catch(() => preserveOnRefreshFailure('specialRecognitions'));
        if (isMounted) setSpecialRecognitions(fresh);
      },
      onProfilesChange: async () => {
        const fresh = loadedSectionsRef.current.has('settings') ? await fetchAllProfiles().catch(() => preserveOnRefreshFailure('users')) : null;
        const { data: authData } = await supabase.auth.getUser();
        const refreshedCurrent = authData.user
          ? await fetchCurrentUserProfile(authData.user.id).catch(() => null)
          : null;
        if (isMounted) {
          if (fresh) setUsers(fresh);
          if (refreshedCurrent?.active) setCurrentUser(refreshedCurrent);
        }
      },
      onStatusChange: (status) => {
        if (isMounted) setDbStatus(status);
      },
    });

    return () => {
      isMounted = false;
      if (android) {
        window.clearInterval(retry);
        window.removeEventListener('offline', goOffline);
        window.removeEventListener('online', reconnect);
        document.removeEventListener('visibilitychange', reconnect);
      }
      authSub.subscription.unsubscribe();
      unsubRealtime();
    };
  }, [loadCoreData, setReadOnly]);

  useEffect(() => {
    if (!currentUser || isLoadingInitialData || offlineReadOnly) return;
    void loadTabData(currentTab);
  }, [currentTab, currentUser, isLoadingInitialData, loadTabData, offlineReadOnly]);

  // Resolve shared links only after normal authentication and authorized data loading.
  useEffect(() => {
    const id = pendingSharedSetlist.current;
    if (!id || !currentUser || isLoadingInitialData || isLoadingCoreData || refreshError || !loadedSectionsRef.current.has('home')) return;
    pendingSharedSetlist.current = null;
    const found = setlists.some(item => item.id === id);
    rememberedSetlists.current = { ids: found ? [id] : [] };
    setInitialSelectedSetlistId(found ? id : null);
    returnSetlistIdRef.current = null;
    savedSetlistScrollPosRef.current = null;
    setSetlistJourney(null);
    setSharedSetlistError(found ? '' : 'This shared setlist is unavailable, or your account does not have access.');
    setCurrentTab('home');
    tabHistoryRef.current = ['home'];
    const clean = new URL(window.location.href);
    clean.searchParams.delete('setlist'); clean.hash = 'home';
    window.history.replaceState({ tab: 'home' }, '', clean.href);
  }, [currentUser, isLoadingInitialData, isLoadingCoreData, refreshError, setlists, sharedLinkRequest]);

  useEffect(() => {
    const receive = (url: string, native = false) => {
      const id = readSetlistShareId(url, native ? undefined : window.location.href);
      if (!id) return;
      pendingSharedSetlist.current = id;
      setSharedLinkRequest(value => value + 1);
    };
    const hashChanged = () => receive(window.location.href);
    window.addEventListener('hashchange', hashChanged);
    const listener = Capacitor.isNativePlatform()
      ? NativeApp.addListener('appUrlOpen', event => receive(event.url, true)) : null;
    if (Capacitor.isNativePlatform()) void NativeApp.getLaunchUrl().then(event => { if (event) receive(event.url, true); });
    return () => { window.removeEventListener('hashchange', hashChanged); if (listener) void listener.then(handle => handle.remove()); };
  }, []);

  const [isNotificationInboxOpen, setNotificationInboxOpen] = useState(false);
  const [notificationSongNumber, setNotificationSongNumber] = useState<{ id: string; request: number } | null>(null);
  const [isNotepadOpen, setNotepadOpen] = useState(false);
  useEffect(() => { setNotepadOpen(false); }, [currentUser?.id]);
  const openAssignedSetlist = useCallback((id: string) => {
    const userId = signedInUserIdRef.current;
    if (!userId) return;
    setCurrentTab('home');
    void fetchSetlists().then(rows => {
      if (signedInUserIdRef.current !== userId) return;
      setSetlists(rows);
      pendingSharedSetlist.current = id;
      setSharedLinkRequest(value => value + 1);
    }).catch(() => {
      if (signedInUserIdRef.current === userId) setSharedSetlistError('Unable to open the latest setlist. Please try again.');
    });
  }, []);
  const openAnnouncementInbox = useCallback(() => setNotificationInboxOpen(true), []);
  const openCalendarNotification = useCallback((kind: 'birthday' | 'event' | 'anniversary' | 'recognition') => {
    const tab = kind === 'event' ? 'special-numbers' : 'recognitions';
    const recognitionSubtab = kind === 'anniversary' ? 'anniversaries' : kind === 'recognition' ? 'special' : 'birthdays';
    if (tab === 'recognitions') window.dispatchEvent(new CustomEvent('qnlbc-open-recognition', {detail:recognitionSubtab}));
    setNotificationInboxOpen(false);
    window.history.pushState({ tab, recognitionSubtab }, '', `#${tab}`); setCurrentTab(tab);
  }, []);
  const notifications = useAssignmentNotifications(currentUser?.id, openAssignedSetlist, openAnnouncementInbox, openCalendarNotification);

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
        fetchSetlists().catch(() => preserveOnRefreshFailure('setlists')),
        fetchSongs().catch(() => preserveOnRefreshFailure('songs')),
        fetchSpecialNumbers().catch(() => preserveOnRefreshFailure('specialNumbers')),
        fetchChoirEntries().catch(() => preserveOnRefreshFailure('choirEntries')),
        fetchPracticeEntries().catch(() => preserveOnRefreshFailure('practiceEntries')),
        fetchBirthdays().catch(() => preserveOnRefreshFailure('birthdays')),
        fetchAnniversaries().catch(() => preserveOnRefreshFailure('anniversaries')),
        fetchVisitors().catch(() => preserveOnRefreshFailure('visitors')),
        fetchSpecialRecognitions().catch(() => preserveOnRefreshFailure('specialRecognitions')),
        fetchMinistrySavedNames().catch(() => preserveOnRefreshFailure('savedNames')),
        fetchAllProfiles().catch(() => preserveOnRefreshFailure('users')),
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
      loadedSectionsRef.current = new Set<AppTab>(['home', 'recognitions', 'special-numbers', 'songs', 'settings']);
    } catch (e) {
      console.warn('Error refreshing data from Supabase', e);
    }
  };

  const pullRefresh = usePullToRefresh(async () => {
    setRefreshError('');
    await Promise.all([reloadAllData(), refreshLocalScreens(), notifications.refresh()]);
  }, Boolean(currentUser) && !offlineReadOnly && !isLoadingInitialData && !isLoadingCoreData && !isPracticeDetailOpen);

  // Tab Navigation
  const handleNavigateTab = useCallback(
    (newTab: AppTab, options?: { instantScroll?: boolean; preserveSongSelection?: boolean }) => {
      if (newTab === currentTab) {
        setCollapseSignals((prev) => ({
          ...prev,
          [newTab]: (prev[newTab] || 0) + 1,
        }));
        return;
      }
      hasActiveSubViewRef.current = false;
      if (newTab === 'songs' && !options?.preserveSongSelection) {
        setSelectedSongIdForTab(null);
        setSongNavigationTrigger(null);
        returnSetlistIdRef.current = null;
      }
      const isReturningToSetlist =
        newTab === 'home' &&
        (Boolean(returnSetlistIdRef.current) ||
          Boolean(savedSetlistScrollPosRef.current) ||
          Boolean(setlistJourney) || Boolean(sessionStorage.getItem('nlbc_saved_setlist_scroll_y')));

      const shouldInstantScroll = Boolean(options?.instantScroll || isReturningToSetlist);

      if (newTab === 'home' && isReturningToSetlist) {
        const targetSetlistId =
          returnSetlistIdRef.current ||
          savedSetlistScrollPosRef.current?.setlistId || setlistJourney?.setlistId ||
          (() => {
            try {
              return sessionStorage.getItem('nlbc_saved_setlist_id');
            } catch {
              return null;
            }
          })();
        if (targetSetlistId) {
          setInitialSelectedSetlistId(targetSetlistId);
        }
      }

      window.history.pushState({ tab: newTab }, '', `#${newTab}`);
      tabHistoryRef.current.push(newTab);
      setCurrentTab(newTab);
      if (!shouldInstantScroll) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [currentTab, setlistJourney]
  );

  // Popstate history listener
  useEffect(() => {
    if (!window.history.state || (!window.history.state.tab && !window.history.state.appRoot)) {
      window.history.replaceState({ tab: currentTab }, '', `#${currentTab}`);
    }

    const handlePopState = (event: PopStateEvent) => {
      if (event.state?.appRoot) return; // The exit guard owns this sentinel.
      if (event.state?.localScreen && !isBackLayerMounted(event.state.localScreen)) {
        window.history.back();
        return;
      }
      const targetTab: AppTab = event.state?.tab || 'home';
      if (currentTab === 'home' && hasActiveSubViewRef.current) return;
      if (currentTab !== 'home' || targetTab !== 'home') {
        const isReturningToSetlist =
          targetTab === 'home' &&
          (Boolean(returnSetlistIdRef.current) ||
            Boolean(savedSetlistScrollPosRef.current) ||
            Boolean(setlistJourney) || Boolean(sessionStorage.getItem('nlbc_saved_setlist_scroll_y')));

        if (targetTab === 'home' && isReturningToSetlist) {
          const targetSetlistId =
            returnSetlistIdRef.current ||
            savedSetlistScrollPosRef.current?.setlistId || setlistJourney?.setlistId ||
            (() => {
              try {
                return sessionStorage.getItem('nlbc_saved_setlist_id');
              } catch {
                return null;
              }
            })();
          if (targetSetlistId) {
            setInitialSelectedSetlistId(targetSetlistId);
          }
        }
        setCurrentTab(targetTab);
        if (!isReturningToSetlist) {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [currentTab, setlistJourney]);

  // Auth Handlers
  const handleSignInSuccess = async (user: UserAccount) => {
    if (isAndroidOfflineLibrary()) {
      await clearOfflineLibrary().catch(console.warn);
      setAndroidSignedOut(false);
      signingOutRef.current = false;
      setReadOnly(false);
      setOfflineLibrary(null);
    }
    outlineCache.current = null;
    rememberedSetlists.current = null;
    setInitialSelectedSetlistId(null);
    returnSetlistIdRef.current = null;
    savedSetlistScrollPosRef.current = null;
    setSetlistJourney(null);
    try {
      sessionStorage.removeItem('nlbc_saved_setlist_id');
      sessionStorage.removeItem('nlbc_saved_setlist_scroll_y');
      localStorage.removeItem('nlbc_selected_setlist_id_v1');
    } catch {}
    setCurrentUser(user);
    setIsLoadingInitialData(false);
    loadedSectionsRef.current.clear();
    sectionLoadPromisesRef.current = {};
    void loadCoreData(user);
    setCurrentTab('special-numbers');
    tabHistoryRef.current = ['special-numbers'];
    window.history.replaceState({ tab: 'special-numbers' }, '', '#special-numbers');
  };

  const handleSignOut = async () => {
    const wasOffline = isAndroidOfflineLibrary() && (offlineReadOnlyRef.current || !window.navigator.onLine);
    if (isAndroidOfflineLibrary()) {
      signingOutRef.current = true;
      setAndroidSignedOut(true);
      coreLoadEpoch.current++;
      setOfflineLibrary(null);
      await clearOfflineLibrary().catch(console.warn);
    }
    outlineCache.current = null;
    pendingSharedSetlist.current = null;
    setSharedSetlistError('');
    rememberedSetlists.current = null;
    exitGuard.cancel();
    setInitialSelectedSetlistId(null);
    returnSetlistIdRef.current = null;
    savedSetlistScrollPosRef.current = null;
    try {
      sessionStorage.removeItem('nlbc_saved_setlist_id');
      sessionStorage.removeItem('nlbc_saved_setlist_scroll_y');
      localStorage.removeItem('nlbc_selected_setlist_id_v1');
    } catch {}
    setNotificationInboxOpen(false);
    if (!wasOffline) {
      await disableAssignmentPush().catch(error => console.warn(error.message));
      await supabase.auth.signOut();
    }
    if (isAndroidOfflineLibrary()) {
      try { clearDeviceAuthSession(); } catch {}
    }
    loadedSectionsRef.current.clear();
    sectionLoadPromisesRef.current = {};
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
    if (isAndroidOfflineLibrary() && (offlineReadOnlyRef.current || !window.navigator.onLine || signingOutRef.current)) return false;
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
    void showAppMessage(`Your account does not have ${permission.toUpperCase()} permission. Please contact an administrator.`);
    return false;
  };

  // Setlist Operations
  const handleReorderSetlists = useCallback(async (date: string, orderedIds: string[], revisions: Record<string, number>) => {
    if (!requirePermission('edit')) throw new Error('Setlist edit permission is required.');
    try {
      const saved = await supabaseSaveSetlistOrder(date, orderedIds, revisions);
      scheduleOfflineSync();
      const changes = new Map(saved.map(item => [item.id, item]));
      setSetlists(previous => previous.map(item => {
        const change = changes.get(item.id);
        return change ? { ...item, ...change, display_order: change.displayOrder, updated_at: change.updatedAt } : item;
      }));
    } catch (error) {
      const fresh = await fetchSetlists().catch(() => preserveOnRefreshFailure('setlists'));
      setSetlists(fresh);
      throw error;
    }
  }, [currentUser]);

  const handleSaveSetlist = useCallback(async (newOrUpdated: Setlist) => {
    const isNew = !setlists.some((s) => s.id === newOrUpdated.id);
    if (!requirePermission(isNew ? 'add' : 'edit')) return false;

    try {
      const saved = await supabaseSaveSetlist(newOrUpdated, isNew);
      scheduleOfflineSync();
      setSetlists((prev) =>
        isNew
          ? [saved, ...prev.filter((s) => s.id !== newOrUpdated.id && s.id !== saved.id)]
          : prev.map((s) => (s.id === newOrUpdated.id ? saved : s))
      );
      return true;
    } catch (err: any) {
      console.error('Failed to save setlist to Supabase:', err);
      // Refresh authoritative list
      const fresh = await fetchSetlists().catch(() => preserveOnRefreshFailure('setlists'));
      setSetlists(fresh);
      void showAppMessage('Unable to save setlist: ' + (err.message || 'Database error'));
      return false;
    }
  }, [setlists, currentUser]);

  const handleDeleteSetlist = useCallback(async (id: string) => {
    if (!requirePermission('delete')) return;
    const target = setlists.find((s) => s.id === id);
    setSetlists((prev) => prev.filter((s) => s.id !== id));

    try {
      await supabaseDeleteSetlist(id, target?.revision || 1);
      scheduleOfflineSync();
    } catch (err: any) {
      console.error('Failed to delete setlist from Supabase:', err);
      const fresh = await fetchSetlists().catch(() => preserveOnRefreshFailure('setlists'));
      setSetlists(fresh);
      void showAppMessage('Unable to delete setlist: ' + (err.message || 'Database error'));
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
      scheduleOfflineSync();
      setSongs((prev) =>
        isNew
          ? [...prev.filter((s) => s.id !== newOrUpdated.id && s.id !== saved.id), saved]
          : prev.map((s) => (s.id === newOrUpdated.id ? saved : s))
      );
      return saved;
    } catch (err: any) {
      console.error('Failed to save song to Supabase:', err);
      const fresh = await fetchSongs().catch(() => preserveOnRefreshFailure('songs'));
      setSongs(fresh);
      void showAppMessage('Unable to save song: ' + (err.message || 'Database error'));
      throw err;
    }
  }, [songs, currentUser]);

  const handleBatchSaveSongs = useCallback(async (updatedSongs: Song[]) => {
    for (const song of updatedSongs) {
      try {
        const isNew = !songs.some((existing) => existing.id === song.id);
        if (!requirePermission(isNew ? 'add' : 'edit')) return;
        const saved = await supabaseSaveSong(song, isNew);
        scheduleOfflineSync();
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
      scheduleOfflineSync();
    } catch (err: any) {
      console.error('Failed to delete song from Supabase:', err);
      const fresh = await fetchSongs().catch(() => preserveOnRefreshFailure('songs'));
      setSongs(fresh);
      void showAppMessage('Unable to delete song: ' + (err.message || 'Database error'));
    }
  }, [songs, currentUser]);

  const saveScheduledLibrarySong = async <T extends Partial<PracticeGroupEntry>,>(
    entry: T,
    songOptions: ScheduleSongSaveOptions,
    isNew: boolean,
    category: 'Special' | 'Choir',
  ): Promise<T> => {
    let song: Song;
    if (songOptions.mode === 'create') {
      const title = songTitleCase(entry.songTitle?.trim() ?? '');
      if (!title) throw new Error('Enter a song title.');
      if (songs.some(existing => existing.title.trim().toLowerCase() === title.toLowerCase())) {
        throw new Error('This song already exists. Use Select song.');
      }
      const draft = upsertSongFromSpecialNumber(title, entry.lyrics, 'minusOneLink' in entry ? String(entry.minusOneLink || '') : undefined);
      song = await handleSaveSong({ ...draft, category, categories: [category] });
      songOptions.onSongSaved(song);
    } else {
      const selected = songs.find(existing => existing.id === entry.songId);
      if (!selected) throw new Error('Select a song from the library, or use Create song.');
      song = selected;
      const lyricsChanged = songOptions.lyricsChanged && entry.lyrics !== song.lyrics;
      if (lyricsChanged && songOptions.songRevision !== undefined && songOptions.songRevision !== (song.revision ?? 1)) {
        throw new Error('This song changed while you were editing. Reopen the entry to review the latest lyrics.');
      }
      const currentCategories = song.categories?.length
        ? song.categories
        : song.category?.split(',').map(value => value.trim()).filter(Boolean) ?? [];
      const needsCategory = !currentCategories.includes(category);
      if (lyricsChanged || needsCategory) {
        const categories = needsCategory
          ? [...currentCategories.filter(value => value.trim().toLowerCase() !== category.toLowerCase()), category]
          : currentCategories;
        song = await handleSaveSong({
          ...song,
          lyrics: lyricsChanged ? entry.lyrics ?? '' : song.lyrics,
          ...(needsCategory && { category: song.category?.trim() || categories[0], categories }),
        });
        if (lyricsChanged) songOptions.onSongSaved(song);
      }
    }
    const useSharedLyrics = isNew || songOptions.mode === 'create' || songOptions.lyricsChanged
      || (entry.lyricsMode ?? entry.lyrics_mode ?? 'live') === 'live';
    return { ...entry, songId: song.id, songTitle: song.title, ...(useSharedLyrics && {
      lyrics: song.lyrics, lyricsSnapshot: song.lyrics, lyricsMode: 'live' as const,
    }) };
  };

  // Special Number Operations
  const handleSaveSpecialNumber = async (entry: SpecialNumberEntry, songOptions?: ScheduleSongSaveOptions) => {
    const isNew = !specialNumbers.some((item) => item.id === entry.id);
    if (!requirePermission(isNew ? 'add' : 'edit')) return false;
    let entryToSave = { ...entry };

    try {
      if (songOptions && (songOptions.mode === 'create' || entry.songTitle?.trim())) {
        entryToSave = await saveScheduledLibrarySong(entryToSave, songOptions, isNew, 'Special');
      } else if (!songOptions && entry.songTitle?.trim()) {
        const existingSong = songs.find(song => song.id === entry.songId)
          || songs.find(song => song.title.trim().toLowerCase() === entry.songTitle!.trim().toLowerCase());
        if (existingSong) {
          entryToSave = { ...entryToSave, songId: existingSong.id, songTitle: existingSong.title };
        } else {
          const songDraft = { ...upsertSongFromSpecialNumber(songTitleCase(entry.songTitle), entry.lyrics, entry.minusOneLink), category: 'Special', categories: ['Special'] };
          const savedSong = await supabaseSaveSong(songDraft, true);
          setSongs(prev => [...prev.filter(song => song.id !== savedSong.id), savedSong]);
          entryToSave = { ...entryToSave, songId: savedSong.id, songTitle: savedSong.title };
        }
      }

      const saved = await supabaseSaveSpecialNumber(entryToSave, isNew);
      scheduleOfflineSync();
      setSpecialNumbers((prev) =>
        isNew
          ? [saved, ...prev.filter((item) => item.id !== entry.id && item.id !== saved.id)]
          : prev.map((item) => (item.id === entry.id ? saved : item))
      );
      return true;
    } catch (err: any) {
      console.error('Failed to save special number:', err);
      const fresh = await fetchSpecialNumbers().catch(() => preserveOnRefreshFailure('specialNumbers'));
      setSpecialNumbers(fresh);
      if (songOptions) throw err;
      return false;
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
      const fresh = await fetchSpecialNumbers().catch(() => preserveOnRefreshFailure('specialNumbers'));
      setSpecialNumbers(fresh);
    }
  };

  // Choir Operations
  const handleSaveChoirEntry = async (entry: ChoirEntry, songOptions?: ScheduleSongSaveOptions) => {
    const isNew = !choirEntries.some((item) => item.id === entry.id);
    if (!requirePermission(isNew ? 'add' : 'edit')) return false;
    let entryToSave = { ...entry };

    try {
      if (songOptions) {
        entryToSave = await saveScheduledLibrarySong(entryToSave, songOptions, isNew, 'Choir');
      } else {
        const existingSong = songs.find(song => song.id === entry.songId)
          || songs.find(song => song.title.trim().toLowerCase() === entry.songTitle.trim().toLowerCase());
        if (existingSong) {
          entryToSave = { ...entryToSave, songId: existingSong.id, songTitle: existingSong.title };
        } else if (entry.songTitle.trim()) {
          const songDraft = { ...upsertSongFromSpecialNumber(songTitleCase(entry.songTitle), entry.lyrics), categories: ['Choir'], category: 'Choir' };
          const savedSong = await supabaseSaveSong(songDraft, true);
          setSongs(prev => [...prev.filter(song => song.id !== savedSong.id), savedSong]);
          entryToSave = { ...entryToSave, songId: savedSong.id, songTitle: savedSong.title };
        }
      }

      const saved = await supabaseSaveChoirEntry(entryToSave, isNew);
      scheduleOfflineSync();
      setChoirEntries((prev) =>
        isNew
          ? [saved, ...prev.filter((item) => item.id !== entry.id && item.id !== saved.id)]
          : prev.map((item) => (item.id === entry.id ? saved : item))
      );
      return true;
    } catch (err: any) {
      console.error('Failed to save choir presentation:', err);
      const fresh = await fetchChoirEntries().catch(() => preserveOnRefreshFailure('choirEntries'));
      setChoirEntries(fresh);
      if (songOptions) throw err;
      return false;
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
      const fresh = await fetchChoirEntries().catch(() => preserveOnRefreshFailure('choirEntries'));
      setChoirEntries(fresh);
    }
  };

  // Practice Group Operations
  const handleSavePracticeEntry = async (
    entry: Partial<PracticeGroupEntry>,
    isNew?: boolean,
    songOptions?: ScheduleSongSaveOptions
  ): Promise<PracticeGroupEntry> => {
    const isActuallyNew = Boolean(
      isNew || !entry.id || !practiceEntries.some((p) => p.id === entry.id)
    );
    if (!requirePermission(isActuallyNew ? 'add' : 'edit')) {
      throw new Error(`Your account does not have ${isActuallyNew ? 'ADD' : 'EDIT'} permission.`);
    }

    if (songOptions) {
      entry = await saveScheduledLibrarySong(entry, songOptions, isActuallyNew, 'Special');
    } else if (entry.songTitle?.trim()) {
      const existingSong = songs.find(song => song.id === entry.songId)
        || songs.find(song => song.title.trim().toLowerCase() === entry.songTitle!.trim().toLowerCase());
      if (existingSong) {
        entry = { ...entry, songId: existingSong.id, songTitle: existingSong.title };
      } else {
        const savedSong = await supabaseSaveSong(upsertSongFromSpecialNumber(songTitleCase(entry.songTitle), entry.lyrics), true);
        setSongs(prev => [...prev.filter(song => song.id !== savedSong.id), savedSong]);
        entry = { ...entry, songId: savedSong.id, songTitle: savedSong.title };
      }
    }

    if (isActuallyNew) {
      try {
        const saved = await supabaseCreatePracticeEntry(entry);
        scheduleOfflineSync();
        setPracticeEntries((prev) => [saved, ...prev.filter((p) => p.id !== saved.id)]);
        return saved;
      } catch (err: any) {
        console.error('Failed to create practice entry:', formatSupabaseError(err), err);
        const fresh = await fetchPracticeEntries().catch(() => preserveOnRefreshFailure('practiceEntries'));
        setPracticeEntries(fresh);
        void showAppMessage('Unable to save practice: ' + (err.message || 'Database error'));
        throw err;
      }
    } else {
      try {
        const saved = await supabaseUpdatePracticeEntry(entry.id!, entry);
        scheduleOfflineSync();
        setPracticeEntries((prev) => prev.map((p) => (p.id === entry.id ? saved : p)));
        return saved;
      } catch (err: any) {
        console.error('Failed to update practice entry:', formatSupabaseError(err), err);
        if (err.code === 'PGRST116' || err.message?.includes('no longer exists')) {
          setPracticeEntries((prev) => prev.filter((p) => p.id !== entry.id));
          const fresh = await fetchPracticeEntries().catch(() => preserveOnRefreshFailure('practiceEntries'));
          setPracticeEntries(fresh);
          void showAppMessage('Practice no longer exists or could not be accessed.');
          throw err;
        }
        const fresh = await fetchPracticeEntries().catch(() => preserveOnRefreshFailure('practiceEntries'));
        setPracticeEntries(fresh);
        void showAppMessage('Unable to save practice: ' + (err.message || 'Database error'));
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
      const fresh = await fetchPracticeEntries().catch(() => preserveOnRefreshFailure('practiceEntries'));
      setPracticeEntries(fresh);
      void showAppMessage('Unable to delete practice: ' + (err.message || 'Database error'));
    }
  };

  const handleSavePracticeVocalPart = async (
    practiceId: string,
    part: import('./types').PracticePartTrack
  ) => {
    if (!requirePermission('upload')) {
      throw new Error('Your account does not have UPLOAD permission.');
    }
    const savedPart = await supabaseSavePracticeVocalPart(practiceId, part);
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
    setPracticeEntries((entries) => entries.map((entry) => {
      if (entry.id !== practiceId) return entry;
      const attachments = [...(entry.customAttachments || entry.attachments || [])];
      const index = attachments.findIndex((item) => item.id === saved.id);
      if (index >= 0) attachments[index] = saved;
      else attachments.push(saved);
      attachments.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      return { ...entry, customAttachments: attachments, attachments };
    }));
    // Persistence is complete. A refresh must never turn it into a failed save.
    void fetchPracticeEntries().then(setPracticeEntries).catch((error) => {
      console.warn('Practice track saved, but practice refresh failed:', error);
    });
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
  const handleSaveBirthday = async (item: BirthdayCelebrant): Promise<boolean> => {
    const isNew = !birthdays.some((existing) => existing.id === item.id);
    if (!requirePermission(isNew ? 'add' : 'edit')) return false;

    try {
      const saved = await supabaseSaveBirthday(item, isNew);
      setBirthdays((prev) =>
        isNew
          ? [...prev.filter((existing) => existing.id !== item.id && existing.id !== saved.id), saved]
          : prev.map((existing) => (existing.id === item.id ? saved : existing))
      );
      return true;
    } catch (err: any) {
      console.error('Failed to save birthday celebrant:', err);
      const fresh = await fetchBirthdays().catch(() => preserveOnRefreshFailure('birthdays'));
      setBirthdays(fresh);
      void showAppMessage('Unable to save celebrant: ' + (err.message || 'Database error'));
      return false;
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
      const fresh = await fetchBirthdays().catch(() => preserveOnRefreshFailure('birthdays'));
      setBirthdays(fresh);
    }
  };

  const handleSaveAnniversary = async (item: AnniversaryCelebrant) => {
    const isNew = !anniversaries.some((existing) => existing.id === item.id);
    if (!requirePermission(isNew ? 'add' : 'edit')) return false;

    try {
      const saved = await supabaseSaveAnniversary(item, isNew);
      setAnniversaries((prev) =>
        isNew
          ? [...prev.filter((existing) => existing.id !== item.id && existing.id !== saved.id), saved]
          : prev.map((existing) => (existing.id === item.id ? saved : existing))
      );
      return true;
    } catch (err: any) {
      console.error('Failed to save anniversary:', err);
      const fresh = await fetchAnniversaries().catch(() => preserveOnRefreshFailure('anniversaries'));
      setAnniversaries(fresh);
      void showAppMessage('Unable to save anniversary: ' + (err.message || 'Database error'));
      return false;
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
      const fresh = await fetchAnniversaries().catch(() => preserveOnRefreshFailure('anniversaries'));
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
      const fresh = await fetchVisitors().catch(() => preserveOnRefreshFailure('visitors'));
      setVisitors(fresh);
      void showAppMessage('Unable to save visitor: ' + (err.message || 'Database error'));
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
      const fresh = await fetchVisitors().catch(() => preserveOnRefreshFailure('visitors'));
      setVisitors(fresh);
    }
  };

  const handleSaveSpecialRecognition = async (item: SpecialRecognition) => {
    const isNew = !specialRecognitions.some((existing) => existing.id === item.id);
    if (!requirePermission(isNew ? 'add' : 'edit')) return false;

    try {
      const saved = await supabaseSaveSpecialRecognition(item, isNew);
      setSpecialRecognitions((prev) =>
        isNew
          ? [saved, ...prev.filter((existing) => existing.id !== item.id && existing.id !== saved.id)]
          : prev.map((existing) => (existing.id === item.id ? saved : existing))
      );
      return true;
    } catch (err: any) {
      console.error('Failed to save recognition:', err);
      const fresh = await fetchSpecialRecognitions().catch(() => preserveOnRefreshFailure('specialRecognitions'));
      setSpecialRecognitions(fresh);
      void showAppMessage('Unable to save recognition: ' + (err.message || 'Database error'));
      return false;
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
      const fresh = await fetchSpecialRecognitions().catch(() => preserveOnRefreshFailure('specialRecognitions'));
      setSpecialRecognitions(fresh);
    }
  };

  // Cross-Navigation Helpers
  const handleOpenSongDetail = (songId: string, returnSetlistId?: string) => {
    returnSetlistIdRef.current = returnSetlistId || null;
    const currentScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    savedSetlistScrollPosRef.current = returnSetlistId ? { setlistId: returnSetlistId, scrollY: currentScrollY } : null;

    if (returnSetlistId) {
      setInitialSelectedSetlistId(returnSetlistId);
      setSetlistJourney({ setlistId: returnSetlistId, scrollY: currentScrollY });
      try {
        sessionStorage.setItem('nlbc_saved_setlist_scroll_y', String(currentScrollY));
        sessionStorage.setItem('nlbc_saved_setlist_id', returnSetlistId);
      } catch {}
    }
    setSelectedSongIdForTab(songId);
    setSongNavigationTrigger({ songId, timestamp: Date.now() });
    handleNavigateTab('songs', { instantScroll: true, preserveSongSelection: true });
  };

  const handleBackToSetlist = () => {
    const targetSetlistId =
      returnSetlistIdRef.current ||
      savedSetlistScrollPosRef.current?.setlistId || setlistJourney?.setlistId ||
      initialSelectedSetlistId ||
      (() => {
        try {
          return sessionStorage.getItem('nlbc_saved_setlist_id');
        } catch {
          return null;
        }
      })();
    if (targetSetlistId) {
      setInitialSelectedSetlistId(targetSetlistId);
    }
    handleNavigateTab('home', { instantScroll: true });
  };

  const handlePlayScheduledSong = (songId: string, mediaUrl: string) => {
    handleOpenSongDetail(songId);
    setSongNavigationTrigger({ songId, mediaUrl, timestamp: Date.now() });
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
    await supabaseSaveMinistrySavedNames(names);
    setSavedNames(names);
  };

  // Native launch stays on its single OS splash; web uses the same logo and church name.
  if (isLoadingInitialData) {
    return (
      <>
        <ExitConfirmation open={exitGuard.isOpen} busy={exitGuard.exiting} message={exitGuard.exitMessage} onCancel={exitGuard.cancel} onExit={() => void exitGuard.confirmExit()} />
        <div role="status" aria-label="Loading QNLBC" className="min-h-dvh bg-white dark:bg-slate-950 flex flex-col gap-3 items-center justify-center">
          {!nativeSplashVisible && <><ChurchLogo className="w-36 h-36 object-contain" /><p className="text-base font-medium text-slate-600 dark:text-slate-300">New Life Baptist Church</p></>}
        </div>
      </>
    );
  }

  // Unauthenticated Gate
  if (!currentUser) {
    return <><AuthScreen onSignInSuccess={handleSignInSuccess} /><ExitConfirmation open={exitGuard.isOpen} busy={exitGuard.exiting} message={exitGuard.exitMessage} onCancel={exitGuard.cancel} onExit={() => void exitGuard.confirmExit()} /></>;
  }

  return (
    <SwipeNavigationProvider currentTab={currentTab} onNavigate={handleNavigateTab}>
    <HeaderSearchProvider>
    <div className="qnlbc-app min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors">
      <PullToRefreshIndicator {...pullRefresh} />
      {/* Sticky Top Header */}
      {isPracticeDetailOpen ? (
        <header data-app-header data-practice-detail-header="true" className="sticky top-0 z-40 bg-white dark:bg-slate-950">
          <div className="mx-auto flex w-full max-w-4xl items-center justify-between p-5">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
              <Users className="h-4 w-4 text-slate-700 dark:text-slate-300" />
              <span>Practice</span>
            </h2>
            <button
              type="button"
              onClick={() => setPracticeCloseSignal((signal) => signal + 1)}
              className="cursor-pointer p-1 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
              aria-label="Close saved practice"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>
      ) : hideMainHeader ? null : (
        <Navbar
          online={isAndroidOfflineLibrary() ? !offlineReadOnly : undefined}
          currentUser={currentUser}
          users={users}
          currentTab={currentTab}
          onNavigateToSettings={() => handleNavigateTab('settings')}
          onOpenNotifications={offlineReadOnly ? undefined : () => { setNotificationInboxOpen(true); void notifications.refresh(); }}
          onOpenNotepad={() => setNotepadOpen(true)}
          unreadNotifications={notifications.unreadCount}
        />
      )}

      {isNotificationInboxOpen && !offlineReadOnly && <NotificationInbox key={currentUser.id} {...notifications} onMarkRead={notifications.markRead} onEnable={notifications.enable} onRefresh={notifications.refresh} onOpen={openAssignedSetlist} onCalendar={openCalendarNotification} onSongNumber={id => { setNotificationSongNumber({ id, request: Date.now() }); setCurrentTab('special-numbers'); window.history.pushState({tab:'special-numbers'}, '', '#special-numbers'); }} onClose={() => setNotificationInboxOpen(false)} />}
      {isNotepadOpen && <Suspense fallback={<div role="status" className="fixed inset-0 z-[180] bg-white dark:bg-slate-950 p-6">Loading notepad…</div>}><Notepad key={currentUser.id + (offlineReadOnly ? (offlineLibrary ? '-offline' : '-restoring') : '')} offlineNotes={offlineReadOnly ? offlineText?.notes ?? [] : undefined} onContentChanged={scheduleOfflineSync} userId={currentUser.id} onClose={() => setNotepadOpen(false)} /></Suspense>}

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-3.5 sm:px-6 py-5 pb-28" style={hideMainHeader ? { paddingTop: 'calc(var(--app-safe-top, 0px) + 1.25rem)' } : undefined}>
        {sharedSetlistError && currentTab === 'home' && <div role="alert" className="mb-4 rounded-xl border border-amber-300 p-3 text-sm">{sharedSetlistError}<button type="button" className="ml-3 underline" onClick={() => setSharedSetlistError('')}>Dismiss</button></div>}
        {refreshError && !offlineReadOnly && <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-300 p-3 text-sm"><span>{refreshError}</span><button type="button" className="ui-secondary" onClick={() => { setRefreshError(''); void reloadAllData(); }}>Retry</button></div>}
        <Suspense fallback={<TabLoadingSkeleton />}>
        {currentTab === 'home' && (isLoadingCoreData ? <TabLoadingSkeleton /> : (
          <SetlistsTab
            readOnly={offlineReadOnly}
            directoryAvatars={directoryAvatars}
            setlists={linkedSetlists}
            songs={songs}
            savedNames={savedNames}
            onSaveSetlist={handleSaveSetlist}
            onReorderSetlists={handleReorderSetlists}
            canReorder={hasPermission('edit')}
            onDeleteSetlist={handleDeleteSetlist}
            onOpenSongDetail={handleOpenSongDetail}
            onSubViewChange={(hasActive) => {
              hasActiveSubViewRef.current = hasActive;
            }}
            initialSelectedSetlistId={rememberedSetlists.current ? rememberedSetlists.current.ids.at(-1) || null : initialSelectedSetlistId || returnSetlistIdRef.current || savedSetlistScrollPosRef.current?.setlistId || setlistJourney?.setlistId}
            initialExpandedSetlistIds={rememberedSetlists.current?.ids}
            onExpandedSetlistsChange={ids => { rememberedSetlists.current = { ids }; }}
            initialScrollY={savedSetlistScrollPosRef.current?.scrollY}
            collapseSignal={collapseSignals.home}
          />
        ))}

        {currentTab === 'recognitions' && (!offlineReadOnly && !loadedSectionsRef.current.has('recognitions') ? <TabLoadingSkeleton /> : (
          <RecognitionsTab
            readOnly={offlineReadOnly}
            birthdays={offlineReadOnly ? offlineText?.birthdays ?? [] : birthdays}
            anniversaries={offlineReadOnly ? offlineText?.anniversaries ?? [] : anniversaries}
            visitors={offlineReadOnly ? offlineText?.visitors ?? [] : visitors}
            specialRecognitions={offlineReadOnly ? offlineText?.recognitions ?? [] : specialRecognitions}
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
        ))}

        {currentTab === 'special-numbers' && (!offlineReadOnly && (isLoadingCoreData || !loadedSectionsRef.current.has('special-numbers')) ? <TabLoadingSkeleton /> : (
          <SpecialNumberTab
            readOnly={offlineReadOnly}
            notificationSongNumber={notificationSongNumber}
            offlineActivities={offlineReadOnly ? offlineLibrary?.activities ?? [] : undefined}
            onActivitiesChanged={scheduleOfflineSync}
            birthdays={offlineReadOnly ? offlineText?.birthdays : birthdays}
            onLoadBirthdays={offlineReadOnly ? undefined : loadCalendarBirthdays}
            currentUser={currentUser}
            specialNumbers={linkedSpecialNumbers}
            practiceEntries={linkedPracticeEntries}
            choirEntries={linkedChoirEntries}
            songs={songs}
            setlists={linkedSetlists}
            savedNames={savedNames}
            onSaveSpecialNumber={handleSaveSpecialNumber}
            onDeleteSpecialNumber={handleDeleteSpecialNumber}
            onSavePracticeEntry={handleSavePracticeEntry}
            onSavePracticeVocalPart={handleSavePracticeVocalPart}
            onDeletePracticeVocalPart={handleDeletePracticeVocalPart}
            onSavePracticeTrack={handleSavePracticeTrack}
            onDeletePracticeTrack={handleDeletePracticeTrack}
            onDeletePracticeEntry={handleDeletePracticeEntry}
            onSaveChoirMedia={async (entry) => {
              if (!requirePermission('edit')) throw new Error('You need edit permission to change choir attachments.');
              const saved = await supabaseSaveChoirEntry(entry, false);
              setChoirEntries(previous => previous.map(item => item.id === saved.id ? saved : item));
            }}
            onSaveChoirEntry={handleSaveChoirEntry}
            onDeleteChoirEntry={handleDeleteChoirEntry}
            onOpenSongDetail={handleOpenSongDetail}
            onSaveSong={handleSaveSong}
            collapseSignal={collapseSignals['special-numbers']}
            onPlaySongMedia={handlePlayScheduledSong}
            onPracticeDetailChange={handlePracticeDetailChange}
            practiceCloseSignal={practiceCloseSignal}
          />
        ))}

        {currentTab === 'songs' && (isLoadingCoreData ? <TabLoadingSkeleton /> : (
          <SongsTab
            readOnly={offlineReadOnly}
            userId={currentUser.id}
              canManageCategories={currentUser?.role === 'admin'}
            songs={songs}
            setlists={linkedSetlists}
            onSaveSong={handleSaveSong}
            onBatchSaveSongs={handleBatchSaveSongs}
            onDeleteSong={handleDeleteSong}
            onAddSongToNewSetlist={handleAddSongToNewSetlist}
            onAddSongToExistingUpcomingSetlist={handleAddSongToExistingUpcomingSetlist}
            initialSelectedSongId={selectedSongIdForTab}
            songNavigationTrigger={songNavigationTrigger}
            onSongMediaConsumed={timestamp => setSongNavigationTrigger(request => request?.timestamp === timestamp ? { ...request, mediaUrl: undefined } : request)}
            onClearInitialSelectedSongId={() => setSelectedSongIdForTab(null)}
            collapseSignal={collapseSignals.songs}
            returnSetlistId={returnSetlistIdRef.current}
            onBackToSetlist={handleBackToSetlist}
          />
        ))}

        {currentTab === 'outlines' && <SermonOutlines key={offlineReadOnly ? (offlineLibrary ? 'offline' : 'restoring') : 'online'} readOnly={offlineReadOnly} currentUser={currentUser} collapseSignal={collapseSignals.outlines}
          initialRows={offlineReadOnly ? offlineText?.outlines ?? [] : outlineCache.current?.userId === currentUser.id ? outlineCache.current.rows : undefined}
          onRowsChange={offlineReadOnly ? undefined : rows => { outlineCache.current = { userId: currentUser.id, rows }; }}
          onContentChanged={scheduleOfflineSync} />}
        {currentTab === 'settings' && offlineReadOnly && <button type="button" className="ui-secondary" onClick={() => void handleSignOut()}>Sign out</button>}
        {currentTab === 'settings' && !offlineReadOnly && (!loadedSectionsRef.current.has('settings') ? <TabLoadingSkeleton /> : (
          <SettingsTab
            onSectionOpenChange={setIsSettingsSectionOpen}
            currentUser={currentUser}
            onUpdateCurrentUser={setCurrentUser}
            users={users}
            onUpdateUsers={setUsers}
            savedNames={savedNames}
            onUpdateSavedNames={handleUpdateSavedNames}
            onDirectoryChanged={members => setSavedNames(members.filter(member => member.active).map(member => member.name))}
            theme={theme}
            appFont={appFont}
            onChangeAppFont={setAppFont}
            onToggleTheme={handleToggleTheme}
            onSignOut={handleSignOut}
            onDataReset={reloadAllData}
            databaseStatus={dbStatus}
            onOpenDatabaseStatusModal={() => setIsStatusModalOpen(true)}
            collapseSignal={collapseSignals.settings}
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
        ))}
        </Suspense>
      </main>

      {/* Mobile-First Bottom Navigation */}
      <BottomNav
        activeTab={currentTab}
        onChangeTab={handleNavigateTab}
      />

      {/* Database Realtime Timestamps & Connection Status Modal */}
      <FirestoreStatusModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        statusInfo={dbStatus}
      />

      <ExitConfirmation open={exitGuard.isOpen} busy={exitGuard.exiting} message={exitGuard.exitMessage} onCancel={exitGuard.cancel} onExit={() => void exitGuard.confirmExit()} />
    </div>
    </HeaderSearchProvider>
    </SwipeNavigationProvider>
  );
}
