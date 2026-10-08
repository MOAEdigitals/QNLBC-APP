import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

test('Android branding and keyboard behavior stay app-like', () => {
  assert.match(read('capacitor.config.ts'), /appName: 'QNLBC App'/);
  assert.match(read('android/app/src/main/res/values/strings.xml'), /<string name="app_name">QNLBC App<\/string>/);
  assert.match(read('android/app/src/main/AndroidManifest.xml'), /android:windowSoftInputMode="adjustNothing"/);
  assert.match(read('index.html'), /interactive-widget=overlays-content/);
});

test('activity filters live in the header, dismiss outside, and preserve description formatting', () => {
  const activities = read('src/features/activities/Activities.tsx');
  assert.match(activities, /filterRef\.current\?\.contains/);
  assert.match(activities, /document\.addEventListener\('pointerdown', close\)/);
  assert.match(activities, /beforeSearch:/);
  assert.match(activities, /aria-label="Filter activities"/);
  assert.match(activities, /whitespace-pre-wrap break-words/);
});

test('lyrics editors auto-grow without nested scrolling or collapse controls', () => {
  const songs = read('src/components/SongsTab.tsx');
  const schedules = read('src/components/SpecialNumberTab.tsx');
  const autoGrow = read('src/components/AutoGrowTextarea.tsx');
  assert.doesNotMatch(songs, /isLyricsExpandedInEditor/);
  assert.doesNotMatch(schedules, /isScheduleModalLyricsExpanded/);
  assert.match(songs, /AutoGrowTextarea/);
  assert.match(schedules, /AutoGrowTextarea/);
  assert.match(autoGrow, /textarea\.scrollHeight/);
  assert.match(autoGrow, /resize-none overflow-hidden/);
  assert.doesNotMatch(schedules, /Mark complete|Mark incomplete/);
});

test('reselecting every main tab closes its open layer before scrolling to top', () => {
  const app = read('src/App.tsx');
  const setlists = read('src/components/SetlistsTab.tsx');
  const recognitions = read('src/components/RecognitionsTab.tsx');
  const schedules = read('src/components/SpecialNumberTab.tsx');
  const activities = read('src/features/activities/Activities.tsx');
  const outlines = read('src/features/sermons/SermonOutlines.tsx');
  const settings = read('src/components/SettingsTab.tsx');
  assert.match(app, /\[newTab\]: \(prev\[newTab\] \|\| 0\) \+ 1/);
  for (const source of [setlists, recognitions, schedules, activities, outlines, settings]) {
    assert.match(source, /window\.scrollTo\(\{ top: 0, behavior: 'smooth' \}\)/);
  }
  assert.match(activities, /if \(expandedActivity\) \{ setExpandedActivity\(null\); return; \}/);
});

test('church directory persists before committing UI state without a search field', () => {
  const settings = read('src/components/SettingsTab.tsx');
  const app = read('src/App.tsx');
  assert.doesNotMatch(settings, /placeholder="Search names"|directoryQuery|filteredDirectoryNames/);
  assert.match(settings, /await onUpdateSavedNames\?\.\(next\)/);
  assert.match(settings, /setSavedNames\(previous\)/);
  assert.match(app, /await supabaseSaveMinistrySavedNames\(names\);[\s\S]*?setSavedNames\(names\)/);
});
