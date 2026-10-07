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

test('activity filters dismiss outside and lyrics editors stay fully open', () => {
  const activities = read('src/features/activities/Activities.tsx');
  assert.match(activities, /filterRef\.current\?\.contains/);
  assert.match(activities, /document\.addEventListener\('pointerdown', close\)/);

  const songs = read('src/components/SongsTab.tsx');
  const schedules = read('src/components/SpecialNumberTab.tsx');
  assert.doesNotMatch(songs, /isLyricsExpandedInEditor/);
  assert.doesNotMatch(schedules, /isScheduleModalLyricsExpanded/);
  assert.match(songs, /id="song-lyrics-input"[\s\S]*?rows=\{18\}/);
  assert.match(schedules, /id="schedule-lyrics-input"[\s\S]*?rows=\{18\}/);
});

test('church directory persists before committing UI state and exposes search', () => {
  const settings = read('src/components/SettingsTab.tsx');
  const app = read('src/App.tsx');
  assert.match(settings, /placeholder="Search names"/);
  assert.match(settings, /await onUpdateSavedNames\?\.\(next\)/);
  assert.match(settings, /setSavedNames\(previous\)/);
  assert.match(app, /await supabaseSaveMinistrySavedNames\(names\);[\s\S]*?setSavedNames\(names\)/);
});
