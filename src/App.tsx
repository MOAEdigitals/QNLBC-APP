import React, { useState, useEffect } from 'react';
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
} from './types';
import {
  loadCurrentSession,
  saveCurrentSession,
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
  upsertSongFromSpecialNumber,
} from './utils/storage';
import { getCurrentRecognitionWindow, categorizeAnnualCelebrants, isPastDate, getNextSundayStr } from './utils/dateUtils';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { AuthScreen } from './components/AuthScreen';
import { SetlistsTab } from './components/SetlistsTab';
import { RecognitionsTab } from './components/RecognitionsTab';
import { SpecialNumberTab } from './components/SpecialNumberTab';
import { SongsTab } from './components/SongsTab';
import { SettingsTab } from './components/SettingsTab';

export default function App() {
  // 1. Auth State
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    const session = loadCurrentSession();
    return session.user;
  });

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

  // 3. App Tab Navigation
  const [currentTab, setCurrentTab] = useState<AppTab>('home');

  // Cross-tab deep links
  const [selectedSongIdForTab, setSelectedSongIdForTab] = useState<string | null>(null);
  const [selectedSetlistIdForTab, setSelectedSetlistIdForTab] = useState<string | null>(null);

  // 4. Core Church Data Entities
  const [setlists, setSetlists] = useState<Setlist[]>(() => loadSetlists());
  const [songs, setSongs] = useState<Song[]>(() => loadSongs());
  const [birthdays, setBirthdays] = useState<BirthdayCelebrant[]>(() => loadBirthdays());
  const [anniversaries, setAnniversaries] = useState<AnniversaryCelebrant[]>(() => loadAnniversaries());
  const [visitors, setVisitors] = useState<Visitor[]>(() => loadVisitors());
  const [specialRecognitions, setSpecialRecognitions] = useState<SpecialRecognition[]>(() => loadSpecialRecognitions());
  const [specialNumbers, setSpecialNumbers] = useState<SpecialNumberEntry[]>(() => loadSpecialNumbers());

  // Reload all data (used when resetting to defaults)
  const reloadAllData = () => {
    setSetlists(loadSetlists());
    setSongs(loadSongs());
    setBirthdays(loadBirthdays());
    setAnniversaries(loadAnniversaries());
    setVisitors(loadVisitors());
    setSpecialRecognitions(loadSpecialRecognitions());
    setSpecialNumbers(loadSpecialNumbers());
  };

  // Auth Handlers
  const handleSignInSuccess = (user: UserAccount) => {
    setCurrentUser(user);
    setCurrentTab('home');
  };

  const handleSignOut = () => {
    saveCurrentSession(null, false);
    setCurrentUser(null);
  };

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Setlist Operations
  const handleSaveSetlist = (newOrUpdated: Setlist) => {
    const idx = setlists.findIndex((s) => s.id === newOrUpdated.id);
    let updated: Setlist[];
    if (idx >= 0) {
      updated = [...setlists];
      updated[idx] = newOrUpdated;
    } else {
      updated = [newOrUpdated, ...setlists];
    }
    setSetlists(updated);
    saveSetlists(updated);
  };

  const handleDeleteSetlist = (id: string) => {
    const updated = setlists.filter((s) => s.id !== id);
    setSetlists(updated);
    saveSetlists(updated);
  };

  // Song Operations
  const handleSaveSong = (newOrUpdated: Song) => {
    const idx = songs.findIndex((s) => s.id === newOrUpdated.id);
    let updated: Song[];
    if (idx >= 0) {
      updated = [...songs];
      updated[idx] = newOrUpdated;
    } else {
      updated = [...songs, newOrUpdated];
    }
    setSongs(updated);
    saveSongs(updated);
  };

  const handleDeleteSong = (id: string) => {
    const updated = songs.filter((s) => s.id !== id);
    setSongs(updated);
    saveSongs(updated);
  };

  // Special Number Operations
  const handleSaveSpecialNumber = (entry: SpecialNumberEntry) => {
    // 1. Sync lyrics into Song Library if lyrics / title provided
    if (entry.songTitle && entry.lyrics) {
      const syncedSong = upsertSongFromSpecialNumber(entry.songTitle, entry.lyrics, entry.minusOneLink);
      entry.songId = syncedSong.id;
      // Reload songs in state
      setSongs(loadSongs());
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
  };

  const handleDeleteSpecialNumber = (id: string) => {
    const updated = specialNumbers.filter((s) => s.id !== id);
    setSpecialNumbers(updated);
    saveSpecialNumbers(updated);
  };

  // Recognitions Operations
  const handleSaveBirthday = (item: BirthdayCelebrant) => {
    const updated = [...birthdays, item];
    setBirthdays(updated);
    saveBirthdays(updated);
  };

  const handleDeleteBirthday = (id: string) => {
    const updated = birthdays.filter((b) => b.id !== id);
    setBirthdays(updated);
    saveBirthdays(updated);
  };

  const handleSaveAnniversary = (item: AnniversaryCelebrant) => {
    const updated = [...anniversaries, item];
    setAnniversaries(updated);
    saveAnniversaries(updated);
  };

  const handleDeleteAnniversary = (id: string) => {
    const updated = anniversaries.filter((a) => a.id !== id);
    setAnniversaries(updated);
    saveAnniversaries(updated);
  };

  const handleSaveVisitor = (item: Visitor) => {
    const updated = [item, ...visitors];
    setVisitors(updated);
    saveVisitors(updated);
  };

  const handleDeleteVisitor = (id: string) => {
    const updated = visitors.filter((v) => v.id !== id);
    setVisitors(updated);
    saveVisitors(updated);
  };

  const handleSaveSpecialRecognition = (item: SpecialRecognition) => {
    const updated = [item, ...specialRecognitions];
    setSpecialRecognitions(updated);
    saveSpecialRecognitions(updated);
  };

  const handleDeleteSpecialRecognition = (id: string) => {
    const updated = specialRecognitions.filter((r) => r.id !== id);
    setSpecialRecognitions(updated);
    saveSpecialRecognitions(updated);
  };

  // Cross-Navigation: Open song in Song Library
  const handleOpenSongDetail = (songId: string) => {
    setSelectedSongIdForTab(songId);
    setCurrentTab('songs');
  };

  // Cross-Navigation: Add song to a new setlist
  const handleAddSongToNewSetlist = (song: Song) => {
    const nextSunday = getNextSundayStr();
    const newSetlist: Setlist = {
      id: `setlist-${Date.now()}`,
      date: nextSunday,
      presider: 'TBA',
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
    setSelectedSetlistIdForTab(newSetlist.id);
    setCurrentTab('home');
  };

  // Cross-Navigation: Add song to an existing upcoming setlist
  const handleAddSongToExistingUpcomingSetlist = (
    song: Song,
    targetSetlistId: string,
    part: 'sundaySchool' | 'worshipService'
  ) => {
    const targetSetlist = setlists.find((s) => s.id === targetSetlistId);
    if (!targetSetlist) return;

    const newItem = {
      id: `${part.substring(0, 2)}-${Date.now()}`,
      songId: song.id,
      title: song.title,
    };

    const updatedPartSongs = [...targetSetlist[part].songs, newItem];

    const updatedSetlist: Setlist = {
      ...targetSetlist,
      [part]: {
        ...targetSetlist[part],
        songs: updatedPartSongs,
      },
      updatedAt: new Date().toISOString(),
    };

    handleSaveSetlist(updatedSetlist);
  };

  // Badge calculations
  const { currentWindow: thisWeekBirthdays } = categorizeAnnualCelebrants<BirthdayCelebrant>(birthdays, (b: BirthdayCelebrant) => b.birthDate);
  const { currentWindow: thisWeekAnniversaries } = categorizeAnnualCelebrants<AnniversaryCelebrant>(anniversaries, (a: AnniversaryCelebrant) => a.anniversaryDate);
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
        currentTab={currentTab}
        onNavigateToSettings={() => setCurrentTab('settings')}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-3.5 sm:px-6 py-5 pb-24">
        {currentTab === 'home' && (
          <SetlistsTab
            setlists={setlists}
            songs={songs}
            onSaveSetlist={handleSaveSetlist}
            onDeleteSetlist={handleDeleteSetlist}
            onOpenSongDetail={handleOpenSongDetail}
            selectedSetlistId={selectedSetlistIdForTab}
            onClearSelectedSetlistId={() => setSelectedSetlistIdForTab(null)}
          />
        )}

        {currentTab === 'recognitions' && (
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
        )}

        {currentTab === 'special-numbers' && (
          <SpecialNumberTab
            specialNumbers={specialNumbers}
            songs={songs}
            onSaveSpecialNumber={handleSaveSpecialNumber}
            onDeleteSpecialNumber={handleDeleteSpecialNumber}
            onOpenSongDetail={handleOpenSongDetail}
          />
        )}

        {currentTab === 'songs' && (
          <SongsTab
            songs={songs}
            setlists={setlists}
            onSaveSong={handleSaveSong}
            onDeleteSong={handleDeleteSong}
            onAddSongToNewSetlist={handleAddSongToNewSetlist}
            onAddSongToExistingUpcomingSetlist={handleAddSongToExistingUpcomingSetlist}
            initialSelectedSongId={selectedSongIdForTab}
            onClearInitialSelectedSongId={() => setSelectedSongIdForTab(null)}
          />
        )}

        {currentTab === 'settings' && (
          <SettingsTab
            currentUser={currentUser}
            theme={theme}
            onToggleTheme={handleToggleTheme}
            onSignOut={handleSignOut}
            onDataReset={reloadAllData}
          />
        )}
      </main>

      {/* Mobile-First Bottom Navigation */}
      <BottomNav
        activeTab={currentTab}
        onChangeTab={(t) => {
          setCurrentTab(t);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        celebrantCount={totalCelebrantsThisWeek}
        upcomingSpecialCount={upcomingSpecialCount}
      />
    </div>
  );
}
