import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  UserAccount,
  AppTab,
  Setlist,
  Song,
  BirthdayCelebrant,
  AnniversaryCelebrant,
  Visitor,
  SpecialRecognition,
  SpecialNumberEntry,
  PracticeGroupEntry,
  ChoirEntry,
} from './types';
import {
  loadCurrentSession,
  saveCurrentSession,
  loadUsers,
  saveUsers,
  loadTheme,
  saveTheme,
  loadSetlists,
  saveSetlists,
  loadSongs,
  saveSongs,
  loadBirthdays,
  saveBirthdays,
  loadAnniversaries,
  saveAnniversaries,
  loadVisitors,
  saveVisitors,
  loadSpecialRecognitions,
  saveSpecialRecognitions,
  loadSpecialNumbers,
  saveSpecialNumbers,
  loadPracticeEntries,
  savePracticeEntries,
  loadChoirEntries,
  saveChoirEntries,
  normalizePracticeEntry,
  upsertSongFromSpecialNumber,
  clearAllLocalDataToZero,
  deleteAllNonAdminUsers,
} from './utils/storage';
import {
  subscribeToCollection,
  syncSaveSetlist,
  syncDeleteSetlist,
  syncSaveSong,
  syncDeleteSong,
  syncSaveSpecialNumber,
  syncDeleteSpecialNumber,
  syncSavePracticeEntry,
  syncDeletePracticeEntry,
  syncSaveChoirEntry,
  syncDeleteChoirEntry,
  syncSaveBirthday,
  syncDeleteBirthday,
  syncSaveAnniversary,
  syncDeleteAnniversary,
  syncSaveVisitor,
  syncDeleteVisitor,
  syncSaveSpecialRecognition,
  syncDeleteSpecialRecognition,
  syncSaveUser,
  syncDeleteAllNonAdminUsers,
  syncSaveSavedNames,
  subscribeToAppSettings,
  subscribeToPracticeAudios,
  initializeFirestoreCloudSeed,
  subscribeToFirestoreStatus,
  getFirestoreConnectionStatus,
  subscribeToGlobalWipe,
  FirestoreStatusInfo,
  isItemTombstoned,
  LEGACY_MOCK_IDS,
} from './firestoreSync';
import {
  loadSavedNames,
  saveSavedNames,
  loadWelcomeSongs,
  saveWelcomeSongs,
  DEFAULT_ADMIN,
} from './utils/storage';
import { saveAudioToStorage } from './utils/audioStorage';
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
import { LogOut, X, AlertTriangle, CloudOff, Database, ExternalLink, Info, Radio } from 'lucide-react';

export default function App() {
  // 1. Auth State
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    const session = loadCurrentSession();
    return session.user;
  });
  const [users, setUsers] = useState<UserAccount[]>(() => loadUsers());

  // Connection and Quota Status
  const [firestoreStatus, setFirestoreStatus] = useState<FirestoreStatusInfo>(() =>
    getFirestoreConnectionStatus()
  );
  const [dismissQuotaBanner, setDismissQuotaBanner] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  // 2. Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => loadTheme());

  // Apply dark class to html tag
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    saveTheme(theme);
  }, [theme]);

  // 3. App Tab Navigation & History Stack (persisted across refreshes)
  const [currentTab, setCurrentTab] = useState<AppTab>(() => {
    // Check URL hash first (e.g. #songs, #recognitions, #settings, #special-numbers)
    const hash = window.location.hash.replace('#', '');
    const validTabs: AppTab[] = ['home', 'recognitions', 'special-numbers', 'songs', 'settings'];
    if (hash && validTabs.includes(hash as AppTab)) {
      return hash as AppTab;
    }
    // Check localStorage next
    try {
      const savedTab = localStorage.getItem('nlbc_active_tab_v1');
      if (savedTab && validTabs.includes(savedTab as AppTab)) {
        return savedTab as AppTab;
      }
    } catch {
      // ignore storage errors
    }
    return 'home';
  });
  const [showLogoutConfirmModal, setShowLogoutConfirmModal] = useState(false);
  const tabHistoryRef = useRef<AppTab[]>([
    (() => {
      const hash = window.location.hash.replace('#', '');
      const validTabs: AppTab[] = ['home', 'recognitions', 'special-numbers', 'songs', 'settings'];
      if (hash && validTabs.includes(hash as AppTab)) return hash as AppTab;
      try {
        const savedTab = localStorage.getItem('nlbc_active_tab_v1');
        if (savedTab && validTabs.includes(savedTab as AppTab)) return savedTab as AppTab;
      } catch {}
      return 'home';
    })()
  ]);
  const hasActiveSubViewRef = useRef(false);
  const [collapseSignals, setCollapseSignals] = useState<Record<string, number>>({});

  // Save active tab on state changes
  useEffect(() => {
    try {
      localStorage.setItem('nlbc_active_tab_v1', currentTab);
    } catch {}
  }, [currentTab]);

  // Cross-tab deep links
  const [selectedSongIdForTab, setSelectedSongIdForTab] = useState<string | null>(null);
  const [initialSelectedSetlistId, setInitialSelectedSetlistId] = useState<string | null>(null);
  const returnSetlistIdRef = useRef<string | null>(null);

  // 4. Core Church Data Entities
  const [setlists, setSetlists] = useState<Setlist[]>(() => loadSetlists());
  const [songs, setSongs] = useState<Song[]>(() => loadSongs());
  const [birthdays, setBirthdays] = useState<BirthdayCelebrant[]>(() => loadBirthdays());
  const [anniversaries, setAnniversaries] = useState<AnniversaryCelebrant[]>(() => loadAnniversaries());
  const [visitors, setVisitors] = useState<Visitor[]>(() => loadVisitors());
  const [specialRecognitions, setSpecialRecognitions] = useState<SpecialRecognition[]>(() => loadSpecialRecognitions());
  const [specialNumbers, setSpecialNumbers] = useState<SpecialNumberEntry[]>(() => loadSpecialNumbers());
  const [choirEntries, setChoirEntries] = useState<ChoirEntry[]>(() => loadChoirEntries());
  const [practiceEntries, setPracticeEntries] = useState<PracticeGroupEntry[]>(() => loadPracticeEntries());
  const [savedNames, setSavedNames] = useState<string[]>(() => loadSavedNames());

  // Subscribe to real-time Firestore synchronization across all devices
  useEffect(() => {
    // Purge all non-admin user accounts and accesses so only Admin remains
    const adminOnlyUsers = deleteAllNonAdminUsers();
    setUsers(adminOnlyUsers);
    syncDeleteAllNonAdminUsers();

    // Seed cloud database on first setup if empty
    initializeFirestoreCloudSeed();

    const unsubSetlists = subscribeToCollection<Setlist>('setlists', (items) => {
      const validRemote = items.filter((i) => !LEGACY_MOCK_IDS.has(i.id));
      setSetlists(validRemote);
      saveSetlists(validRemote);
    });

    const unsubSongs = subscribeToCollection<Song>('songs', (items) => {
      const validRemote = items.filter((i) => !LEGACY_MOCK_IDS.has(i.id));
      setSongs(validRemote);
      saveSongs(validRemote);
    });

    const unsubBirthdays = subscribeToCollection<BirthdayCelebrant>('birthdays', (items) => {
      const validRemote = items.filter((i) => !LEGACY_MOCK_IDS.has(i.id));
      setBirthdays(validRemote);
      saveBirthdays(validRemote);
    });

    const unsubAnniv = subscribeToCollection<AnniversaryCelebrant>('anniversaries', (items) => {
      const validRemote = items.filter((i) => !LEGACY_MOCK_IDS.has(i.id));
      setAnniversaries(validRemote);
      saveAnniversaries(validRemote);
    });

    const unsubVisitors = subscribeToCollection<Visitor>('visitors', (items) => {
      const validRemote = items.filter((i) => !LEGACY_MOCK_IDS.has(i.id));
      setVisitors(validRemote);
      saveVisitors(validRemote);
    });

    const unsubRecognitions = subscribeToCollection<SpecialRecognition>('special_recognitions', (items) => {
      const validRemote = items.filter((i) => !LEGACY_MOCK_IDS.has(i.id));
      setSpecialRecognitions(validRemote);
      saveSpecialRecognitions(validRemote);
    });

    const unsubSpecials = subscribeToCollection<SpecialNumberEntry>('special_numbers', (items) => {
      const validRemote = items.filter((i) => !LEGACY_MOCK_IDS.has(i.id));
      setSpecialNumbers(validRemote);
      saveSpecialNumbers(validRemote);
    });

    const unsubChoir = subscribeToCollection<ChoirEntry>('choir_entries', (items) => {
      const validRemote = items.filter((i) => !LEGACY_MOCK_IDS.has(i.id));
      setChoirEntries(validRemote);
      saveChoirEntries(validRemote);
    });

    const unsubPractice = subscribeToCollection<PracticeGroupEntry>('practice_entries', (items) => {
      const currentLocal = loadPracticeEntries();
      const validRemote = items
        .filter((remoteItem) => !LEGACY_MOCK_IDS.has(remoteItem.id))
        .map((remoteItem) => {
          const localMatch = currentLocal.find((l) => l.id === remoteItem.id);
          const normalized = normalizePracticeEntry(remoteItem);
          if (!localMatch) return normalized;

          // Preserve local vocal parts audio URLs if remote has placeholder or if local is active
          const mergedVocalParts = (normalized.vocalParts || []).map((vp) => {
            const localPart = (localMatch.vocalParts || localMatch.parts || []).find((lp) => lp.id === vp.id);
            if (localPart && localPart.audioUrl && (!vp.audioUrl || vp.audioUrl === 'indexeddb:local_storage')) {
              return { ...vp, audioUrl: localPart.audioUrl };
            }
            return vp;
          });

          return {
            ...normalized,
            vocalParts: mergedVocalParts,
            parts: mergedVocalParts,
          };
        });

      setPracticeEntries(validRemote);
      savePracticeEntries(validRemote);
    });

    const unsubUsers = subscribeToCollection<UserAccount>('users', (items) => {
      const validUsers = items.filter((u) => !isItemTombstoned('users', u.id));
      if (!validUsers.some((u) => u.username.toLowerCase() === DEFAULT_ADMIN.username.toLowerCase())) {
        validUsers.unshift(DEFAULT_ADMIN);
      }
      setUsers(validUsers);
      saveUsers(validUsers);

      // If the currently logged in user on this device had their profile updated or removed:
      setCurrentUser((prevUser) => {
        if (!prevUser) return null;
        const updatedSelf = validUsers.find(
          (u) => u.id === prevUser.id || u.username.toLowerCase() === prevUser.username.toLowerCase()
        );
        if (!updatedSelf) {
          saveCurrentSession(null, false);
          return null;
        }
        if (
          updatedSelf.username !== prevUser.username ||
          updatedSelf.passwordHash !== prevUser.passwordHash ||
          updatedSelf.avatar !== prevUser.avatar ||
          updatedSelf.role !== prevUser.role
        ) {
          saveCurrentSession(updatedSelf, true);
          return updatedSelf;
        }
        return prevUser;
      });
    });

    const unsubAppSettings = subscribeToAppSettings(
      (remoteNames) => {
        setSavedNames(remoteNames);
        saveSavedNames(remoteNames);
      },
      (remoteSongs) => {
        saveWelcomeSongs(remoteSongs);
      },
      () => {
        // When a remote deletion tombstone is received from another device, filter active state immediately
        setPracticeEntries((prev) => {
          const filtered = prev.filter((p) => !isItemTombstoned('practice_entries', p.id));
          if (filtered.length !== prev.length) savePracticeEntries(filtered);
          return filtered;
        });
        setSetlists((prev) => {
          const filtered = prev.filter((s) => !isItemTombstoned('setlists', s.id));
          if (filtered.length !== prev.length) saveSetlists(filtered);
          return filtered;
        });
        setSongs((prev) => {
          const filtered = prev.filter((s) => !isItemTombstoned('songs', s.id));
          if (filtered.length !== prev.length) saveSongs(filtered);
          return filtered;
        });
        setSpecialNumbers((prev) => {
          const filtered = prev.filter((s) => !isItemTombstoned('special_numbers', s.id));
          if (filtered.length !== prev.length) saveSpecialNumbers(filtered);
          return filtered;
        });
        setChoirEntries((prev) => {
          const filtered = prev.filter((c) => !isItemTombstoned('choir_entries', c.id));
          if (filtered.length !== prev.length) saveChoirEntries(filtered);
          return filtered;
        });
        setBirthdays((prev) => {
          const filtered = prev.filter((b) => !isItemTombstoned('birthdays', b.id));
          if (filtered.length !== prev.length) saveBirthdays(filtered);
          return filtered;
        });
        setAnniversaries((prev) => {
          const filtered = prev.filter((a) => !isItemTombstoned('anniversaries', a.id));
          if (filtered.length !== prev.length) saveAnniversaries(filtered);
          return filtered;
        });
        setVisitors((prev) => {
          const filtered = prev.filter((v) => !isItemTombstoned('visitors', v.id));
          if (filtered.length !== prev.length) saveVisitors(filtered);
          return filtered;
        });
        setSpecialRecognitions((prev) => {
          const filtered = prev.filter((r) => !isItemTombstoned('special_recognitions', r.id));
          if (filtered.length !== prev.length) saveSpecialRecognitions(filtered);
          return filtered;
        });
      }
    );

    // Auto-sync audio files & recordings from cloud in real time
    const unsubPracticeAudios = subscribeToPracticeAudios((audioId, dataUrl) => {
      saveAudioToStorage(audioId, dataUrl);
    });

    const unsubFirestoreStatus = subscribeToFirestoreStatus((statusInfo) => {
      setFirestoreStatus(statusInfo);
    });

    // Listen for global cloud wipe events to reset all devices to 0
    const unsubGlobalWipe = subscribeToGlobalWipe((wipeTs) => {
      const lastApplied = Number(localStorage.getItem('nlbc_last_applied_wipe_ts') || '0');
      if (wipeTs > lastApplied) {
        localStorage.setItem('nlbc_last_applied_wipe_ts', String(wipeTs));
        clearAllLocalDataToZero();
        setSetlists([]);
        setSongs([]);
        setBirthdays([]);
        setAnniversaries([]);
        setVisitors([]);
        setSpecialRecognitions([]);
        setSpecialNumbers([]);
        setChoirEntries([]);
        setPracticeEntries([]);
        setSavedNames([]);
      }
    });

    return () => {
      unsubSetlists();
      unsubSongs();
      unsubBirthdays();
      unsubAnniv();
      unsubVisitors();
      unsubRecognitions();
      unsubSpecials();
      unsubChoir();
      unsubPractice();
      unsubUsers();
      unsubAppSettings();
      unsubPracticeAudios();
      unsubFirestoreStatus();
      unsubGlobalWipe();
    };
  }, []);

  // Reload all data (used when resetting to defaults or loading backup)
  const reloadAllData = () => {
    setUsers(loadUsers());
    setSetlists(loadSetlists());
    setSongs(loadSongs());
    setBirthdays(loadBirthdays());
    setAnniversaries(loadAnniversaries());
    setVisitors(loadVisitors());
    setSpecialRecognitions(loadSpecialRecognitions());
    setSpecialNumbers(loadSpecialNumbers());
    setChoirEntries(loadChoirEntries());
    setPracticeEntries(loadPracticeEntries());
    setSavedNames(loadSavedNames());
  };

  // Navigate to a new tab with history tracking (or collapse active container if clicking same tab)
  const handleNavigateTab = useCallback((newTab: AppTab) => {
    if (newTab === currentTab) {
      // Tapping the active tab icon triggers container collapse
      setCollapseSignals((prev) => ({
        ...prev,
        [newTab]: (prev[newTab] || 0) + 1,
      }));
      return;
    }

    // Push new state to browser history for standard back/swipe gestures
    window.history.pushState({ tab: newTab }, '', `#${newTab}`);
    tabHistoryRef.current.push(newTab);
    setCurrentTab(newTab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentTab]);

  // Browser Back / Swipe Back Interceptor
  useEffect(() => {
    // Initialize base history state on load with current active tab
    if (!window.history.state || !window.history.state.tab) {
      window.history.replaceState({ tab: currentTab }, '', `#${currentTab}`);
    }

    const handlePopState = (event: PopStateEvent) => {
      const targetTab: AppTab = event.state?.tab || 'home';

      if (currentTab !== 'home') {
        // If we are returning from songs tab back to home, restore expanded setlist if we came from lyrics link
        if (targetTab === 'home' && returnSetlistIdRef.current) {
          setInitialSelectedSetlistId(returnSetlistIdRef.current);
          returnSetlistIdRef.current = null;
        }

        // If we are not on home, go back to targetTab or home
        setCurrentTab(targetTab);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        // If we are on Home and an expanded setlist or editor modal is active,
        // SetlistsTab's handler takes precedence (collapses setlist or closes editor)
        if (hasActiveSubViewRef.current) {
          return;
        }

        // If we are already on Home with nothing expanded and press/swipe back:
        // Prompt for logout or cancel per specification
        setShowLogoutConfirmModal(true);
        // Push a state again to prevent immediately leaving window if they cancel
        window.history.pushState({ tab: 'home' }, '', '#home');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [currentTab]);

  // Auth Handlers
  const handleSignInSuccess = (user: UserAccount) => {
    setCurrentUser(user);
    setUsers(loadUsers());
    setCurrentTab('home');
    tabHistoryRef.current = ['home'];
    window.history.replaceState({ tab: 'home' }, '', '#home');
  };

  const handleSignOut = () => {
    setShowLogoutConfirmModal(false);
    saveCurrentSession(null, false);
    setCurrentUser(null);
    window.history.replaceState(null, '', window.location.pathname);
  };

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Setlist Operations
  const handleSaveSetlist = useCallback((newOrUpdated: Setlist) => {
    setSetlists((prev) => {
      const idx = prev.findIndex((s) => s.id === newOrUpdated.id);
      let updated: Setlist[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = newOrUpdated;
      } else {
        updated = [newOrUpdated, ...prev];
      }
      saveSetlists(updated);
      return updated;
    });
    syncSaveSetlist(newOrUpdated);
  }, []);

  const handleDeleteSetlist = useCallback((id: string) => {
    setSetlists((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      saveSetlists(updated);
      return updated;
    });
    syncDeleteSetlist(id);
  }, []);

  // Song Operations
  const handleSaveSong = useCallback((newOrUpdated: Song) => {
    setSongs((prev) => {
      const idx = prev.findIndex((s) => s.id === newOrUpdated.id);
      let updated: Song[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = newOrUpdated;
      } else {
        updated = [...prev, newOrUpdated];
      }
      saveSongs(updated);
      return updated;
    });
    syncSaveSong(newOrUpdated);
  }, []);

  const handleDeleteSong = useCallback((id: string) => {
    setSongs((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      saveSongs(updated);
      return updated;
    });
    syncDeleteSong(id);
  }, []);

  // Special Number Operations
  const handleSaveSpecialNumber = (entry: SpecialNumberEntry) => {
    if (entry.songTitle && entry.lyrics) {
      const syncedSong = upsertSongFromSpecialNumber(entry.songTitle, entry.lyrics, entry.minusOneLink);
      entry.songId = syncedSong.id;
      setSongs(loadSongs());
      syncSaveSong(syncedSong);
    }

    const idx = specialNumbers.findIndex((s) => s.id === entry.id);
    let updated: SpecialNumberEntry[];
    if (idx >= 0) {
      updated = [...specialNumbers];
      updated[idx] = entry;
    } else {
      updated = [entry, ...specialNumbers];
    }
    setSpecialNumbers(updated);
    saveSpecialNumbers(updated);
    syncSaveSpecialNumber(entry);
  };

  const handleDeleteSpecialNumber = (id: string) => {
    const updated = specialNumbers.filter((s) => s.id !== id);
    setSpecialNumbers(updated);
    saveSpecialNumbers(updated);
    syncDeleteSpecialNumber(id);
  };

  // Choir Operations
  const handleSaveChoirEntry = (entry: ChoirEntry) => {
    if (entry.songTitle && entry.lyrics) {
      const syncedSong = upsertSongFromSpecialNumber(entry.songTitle, entry.lyrics);
      entry.songId = syncedSong.id;
      setSongs(loadSongs());
      syncSaveSong(syncedSong);
    }

    const idx = choirEntries.findIndex((c) => c.id === entry.id);
    let updated: ChoirEntry[];
    if (idx >= 0) {
      updated = [...choirEntries];
      updated[idx] = entry;
    } else {
      updated = [entry, ...choirEntries];
    }
    setChoirEntries(updated);
    saveChoirEntries(updated);
    syncSaveChoirEntry(entry);
  };

  const handleDeleteChoirEntry = (id: string) => {
    const updated = choirEntries.filter((c) => c.id !== id);
    setChoirEntries(updated);
    saveChoirEntries(updated);
    syncDeleteChoirEntry(id);
  };

  // Practice Group / Song Operations
  const handleSavePracticeEntry = (entry: PracticeGroupEntry) => {
    const idx = practiceEntries.findIndex((p) => p.id === entry.id);
    let updated: PracticeGroupEntry[];
    if (idx >= 0) {
      updated = [...practiceEntries];
      updated[idx] = entry;
    } else {
      updated = [entry, ...practiceEntries];
    }
    setPracticeEntries(updated);
    savePracticeEntries(updated);
    syncSavePracticeEntry(entry);
  };

  const handleDeletePracticeEntry = (id: string) => {
    const updated = practiceEntries.filter((p) => p.id !== id);
    setPracticeEntries(updated);
    savePracticeEntries(updated);
    syncDeletePracticeEntry(id);
  };

  // Recognitions Operations
  const handleSaveBirthday = (item: BirthdayCelebrant) => {
    const idx = birthdays.findIndex((b) => b.id === item.id);
    const updated = idx >= 0 ? [...birthdays] : [...birthdays, item];
    if (idx >= 0) updated[idx] = item;
    setBirthdays(updated);
    saveBirthdays(updated);
    syncSaveBirthday(item);
  };

  const handleDeleteBirthday = (id: string) => {
    const updated = birthdays.filter((b) => b.id !== id);
    setBirthdays(updated);
    saveBirthdays(updated);
    syncDeleteBirthday(id);
  };

  const handleSaveAnniversary = (item: AnniversaryCelebrant) => {
    const idx = anniversaries.findIndex((a) => a.id === item.id);
    const updated = idx >= 0 ? [...anniversaries] : [...anniversaries, item];
    if (idx >= 0) updated[idx] = item;
    setAnniversaries(updated);
    saveAnniversaries(updated);
    syncSaveAnniversary(item);
  };

  const handleDeleteAnniversary = (id: string) => {
    const updated = anniversaries.filter((a) => a.id !== id);
    setAnniversaries(updated);
    saveAnniversaries(updated);
    syncDeleteAnniversary(id);
  };

  const handleSaveVisitor = (item: Visitor) => {
    const idx = visitors.findIndex((v) => v.id === item.id);
    const updated = idx >= 0 ? [...visitors] : [item, ...visitors];
    if (idx >= 0) updated[idx] = item;
    setVisitors(updated);
    saveVisitors(updated);
    syncSaveVisitor(item);
  };

  const handleDeleteVisitor = (id: string) => {
    const updated = visitors.filter((v) => v.id !== id);
    setVisitors(updated);
    saveVisitors(updated);
    syncDeleteVisitor(id);
  };

  const handleSaveSpecialRecognition = (item: SpecialRecognition) => {
    const idx = specialRecognitions.findIndex((r) => r.id === item.id);
    const updated = idx >= 0 ? [...specialRecognitions] : [item, ...specialRecognitions];
    if (idx >= 0) updated[idx] = item;
    setSpecialRecognitions(updated);
    saveSpecialRecognitions(updated);
    syncSaveSpecialRecognition(item);
  };

  const handleDeleteSpecialRecognition = (id: string) => {
    const updated = specialRecognitions.filter((r) => r.id !== id);
    setSpecialRecognitions(updated);
    saveSpecialRecognitions(updated);
    syncDeleteSpecialRecognition(id);
  };

  // Cross-Navigation: Open song in Song Library
  const handleOpenSongDetail = (songId: string, returnSetlistId?: string) => {
    returnSetlistIdRef.current = returnSetlistId || null;
    setSelectedSongIdForTab(songId);
    handleNavigateTab('songs');
  };

  // Cross-Navigation: Add song to a new setlist
  const handleAddSongToNewSetlist = (song: Song) => {
    const nextSunday = getNextSundayStr();
    const newSetlist: Setlist = {
      id: `setlist-${Date.now()}`,
      type: 'sunday',
      date: nextSunday,
      presider: 'TBA',
      welcomeSong: 'Napakaligaya',
      closingSong: 'Give Thanks',
      sundaySchool: {
        songLeader: 'TBA',
        songs: [
          { id: `ss-1`, title: 'Opening Song' },
          { id: `ss-2`, title: 'Response Song' },
        ],
      },
      worshipService: {
        songLeader: 'TBA',
        songs: [
          { id: `ws-1`, songId: song.id, title: song.title },
          { id: `ws-2`, title: 'Song 2' },
          { id: `ws-3`, title: 'Song 3' },
        ],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    handleSaveSetlist(newSetlist);
    handleNavigateTab('home');
  };

  // Cross-Navigation: Add song to an existing upcoming setlist
  const handleAddSongToExistingUpcomingSetlist = (
    song: Song,
    targetSetlistId: string,
    part: 'sundaySchool' | 'worshipService'
  ) => {
    const targetSetlist = setlists.find((s) => s.id === targetSetlistId);
    if (!targetSetlist) return;

    const currentPart = targetSetlist[part] || { songLeader: '', songs: [] };
    const newItem = {
      id: `${part.substring(0, 2)}-${Date.now()}`,
      songId: song.id,
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

  // Unauthenticated Gate
  if (!currentUser) {
    return <AuthScreen onSignInSuccess={handleSignInSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors">
      {/* Sticky Top Header */}
      <Navbar
        currentUser={currentUser}
        users={users}
        currentTab={currentTab}
        onNavigateToSettings={() => handleNavigateTab('settings')}
        firestoreStatus={firestoreStatus}
        onOpenFirestoreStatusModal={() => setIsStatusModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-3.5 sm:px-6 py-5 pb-28">
        {/* Firestore Quota / Connection Status Notice */}
        {firestoreStatus.status === 'quota-exceeded' && !dismissQuotaBanner && (
          <div className="mb-4 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 text-xs sm:text-sm flex items-start justify-between gap-3 shadow-xs">
            <div className="flex items-start gap-2.5">
              <Database className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold flex items-center gap-2">
                  <span>Firestore Daily Free Write Quota Reached</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-amber-200/80 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200">
                    Offline Mode Active
                  </span>
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                  {firestoreStatus.quotaResetMessage}
                </p>
                <div className="pt-1 flex items-center gap-4 text-xs font-medium flex-wrap">
                  <button
                    type="button"
                    onClick={() => setIsStatusModalOpen(true)}
                    className="inline-flex items-center gap-1 font-bold text-amber-900 dark:text-amber-100 bg-amber-200/60 dark:bg-amber-900/60 px-2 py-0.5 rounded hover:bg-amber-300/60 cursor-pointer transition-colors"
                  >
                    <Radio className="w-3 h-3 text-amber-700 dark:text-amber-300" />
                    <span>View Collection Sync Logs</span>
                  </button>
                  <a
                    href={firestoreStatus.databaseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300 underline hover:text-amber-900 dark:hover:text-amber-100 transition-colors"
                  >
                    <span>View Firebase Quotas / Upgrade</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href="https://firebase.google.com/pricing#cloud-firestore"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300 underline hover:text-amber-900 dark:hover:text-amber-100 transition-colors"
                  >
                    <span>Pricing Details</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
            <button
              onClick={() => setDismissQuotaBanner(true)}
              className="p-1 rounded-lg text-amber-700 hover:bg-amber-200/60 dark:text-amber-300 dark:hover:bg-amber-900/60 transition-colors shrink-0 cursor-pointer"
              title="Dismiss notice"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {firestoreStatus.status === 'offline' && !dismissQuotaBanner && (
          <div className="mb-4 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs sm:text-sm flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <CloudOff className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
              <span className="text-xs">
                Firestore backend is currently unreachable. Operating in local offline storage mode — all data is saved locally.
              </span>
              <button
                type="button"
                onClick={() => setIsStatusModalOpen(true)}
                className="ml-2 inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                <span>View Sync Logs</span>
              </button>
            </div>
            <button
              onClick={() => setDismissQuotaBanner(true)}
              className="p-1 rounded-lg text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors shrink-0 cursor-pointer"
              title="Dismiss notice"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

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
            onDeleteSong={handleDeleteSong}
            onAddSongToNewSetlist={handleAddSongToNewSetlist}
            onAddSongToExistingUpcomingSetlist={handleAddSongToExistingUpcomingSetlist}
            initialSelectedSongId={selectedSongIdForTab}
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
            onUpdateSavedNames={setSavedNames}
            theme={theme}
            onToggleTheme={handleToggleTheme}
            onSignOut={handleSignOut}
            onDataReset={reloadAllData}
            firestoreStatus={firestoreStatus}
            onOpenFirestoreStatusModal={() => setIsStatusModalOpen(true)}
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

      {/* Firestore Real-Time Collection Sync Timestamps Modal */}
      <FirestoreStatusModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        statusInfo={firestoreStatus}
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
