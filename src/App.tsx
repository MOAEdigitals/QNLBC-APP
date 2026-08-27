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
  normalizePracticeEntry,
  upsertSongFromSpecialNumber,
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
  syncSaveBirthday,
  syncDeleteBirthday,
  syncSaveAnniversary,
  syncDeleteAnniversary,
  syncSaveVisitor,
  syncDeleteVisitor,
  syncSaveSpecialRecognition,
  syncDeleteSpecialRecognition,
  syncSaveUser,
  syncSaveSavedNames,
  subscribeToAppSettings,
  subscribeToPracticeAudios,
  initializeFirestoreCloudSeed,
} from './firestoreSync';
import {
  loadSavedNames,
  saveSavedNames,
  loadWelcomeSongs,
  saveWelcomeSongs,
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
import { LogOut, X, AlertTriangle } from 'lucide-react';

export default function App() {
  // 1. Auth State
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    const session = loadCurrentSession();
    return session.user;
  });
  const [users, setUsers] = useState<UserAccount[]>(() => loadUsers());

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
  const [practiceEntries, setPracticeEntries] = useState<PracticeGroupEntry[]>(() => loadPracticeEntries());
  const [savedNames, setSavedNames] = useState<string[]>(() => loadSavedNames());

  // Subscribe to real-time Firestore synchronization across all devices
  useEffect(() => {
    // Seed cloud database on first setup if empty
    initializeFirestoreCloudSeed();

    const unsubSetlists = subscribeToCollection<Setlist>('setlists', (items) => {
      setSetlists(items);
      saveSetlists(items);
    });

    const unsubSongs = subscribeToCollection<Song>('songs', (items) => {
      setSongs(items);
      saveSongs(items);
    });

    const unsubBirthdays = subscribeToCollection<BirthdayCelebrant>('birthdays', (items) => {
      setBirthdays(items);
      saveBirthdays(items);
    });

    const unsubAnniv = subscribeToCollection<AnniversaryCelebrant>('anniversaries', (items) => {
      setAnniversaries(items);
      saveAnniversaries(items);
    });

    const unsubVisitors = subscribeToCollection<Visitor>('visitors', (items) => {
      setVisitors(items);
      saveVisitors(items);
    });

    const unsubRecognitions = subscribeToCollection<SpecialRecognition>('special_recognitions', (items) => {
      setSpecialRecognitions(items);
      saveSpecialRecognitions(items);
    });

    const unsubSpecials = subscribeToCollection<SpecialNumberEntry>('special_numbers', (items) => {
      setSpecialNumbers(items);
      saveSpecialNumbers(items);
    });

    const unsubPractice = subscribeToCollection<PracticeGroupEntry>('practice_entries', (items) => {
      const currentLocal = loadPracticeEntries();
      const merged = items.map((remoteItem) => {
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

      setPracticeEntries(merged);
      savePracticeEntries(merged);
    });

    const unsubUsers = subscribeToCollection<UserAccount>('users', (items) => {
      setUsers(items);
      saveUsers(items);
    });

    const unsubAppSettings = subscribeToAppSettings(
      (remoteNames) => {
        setSavedNames(remoteNames);
        saveSavedNames(remoteNames);
      },
      (remoteSongs) => {
        saveWelcomeSongs(remoteSongs);
      }
    );

    // Auto-sync audio files & recordings from cloud in real time
    const unsubPracticeAudios = subscribeToPracticeAudios((audioId, dataUrl) => {
      saveAudioToStorage(audioId, dataUrl);
    });

    return () => {
      unsubSetlists();
      unsubSongs();
      unsubBirthdays();
      unsubAnniv();
      unsubVisitors();
      unsubRecognitions();
      unsubSpecials();
      unsubPractice();
      unsubUsers();
      unsubAppSettings();
      unsubPracticeAudios();
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
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-3.5 sm:px-6 py-5 pb-28">
        <div className={currentTab === 'home' ? 'block' : 'hidden'}>
          <SetlistsTab
            setlists={setlists}
            songs={songs}
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
          />
        </div>

        <div className={currentTab === 'special-numbers' ? 'block' : 'hidden'}>
          <SpecialNumberTab
            specialNumbers={specialNumbers}
            practiceEntries={practiceEntries}
            songs={songs}
            setlists={setlists}
            onSaveSpecialNumber={handleSaveSpecialNumber}
            onDeleteSpecialNumber={handleDeleteSpecialNumber}
            onSavePracticeEntry={handleSavePracticeEntry}
            onDeletePracticeEntry={handleDeletePracticeEntry}
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
