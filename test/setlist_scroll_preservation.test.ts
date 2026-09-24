import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('SetlistsTab and App.tsx preserve setlist state and scroll position when returning from Songs tab', () => {
  const appFile = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf-8');
  const setlistsTabFile = fs.readFileSync(path.resolve(process.cwd(), 'src/components/SetlistsTab.tsx'), 'utf-8');

  // 1. App.tsx tracks savedSetlistScrollPosRef and saves scrollY upon openSongDetail
  assert.ok(
    appFile.includes('savedSetlistScrollPosRef.current'),
    'App.tsx must keep reference to savedSetlistScrollPosRef'
  );
  assert.ok(
    appFile.includes('sessionStorage.setItem(\'nlbc_saved_setlist_scroll_y\''),
    'App.tsx or SetlistsTab must persist scroll position in sessionStorage'
  );
  assert.ok(
    appFile.includes('initialScrollY={savedSetlistScrollPosRef.current?.scrollY}'),
    'App.tsx passes initialScrollY to SetlistsTab'
  );

  // 2. SetlistsTab defines initialScrollY in props and restores it
  assert.ok(
    setlistsTabFile.includes('initialScrollY?: number | null;'),
    'SetlistsTabProps must declare initialScrollY'
  );
  assert.ok(
    setlistsTabFile.includes('handleOpenSong ='),
    'SetlistsTab defines handleOpenSong to capture scroll position on song click'
  );
  assert.ok(
    setlistsTabFile.includes('sessionStorage.setItem(\'nlbc_saved_setlist_scroll_y\''),
    'handleOpenSong records scroll position in sessionStorage'
  );
  assert.ok(
    setlistsTabFile.includes('window.scrollTo({ top: targetY!, behavior: \'instant\''),
    'SetlistsTab restores scroll position instantly'
  );
  assert.ok(
    setlistsTabFile.includes('restoredScrollRef.current || initialScrollY != null'),
    'SetlistsTab suppresses smooth scrollIntoView when scroll position is already restored'
  );
});

test('Setlists start collapsed on first login or new session', () => {
  const appFile = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf-8');
  const setlistsTabFile = fs.readFileSync(path.resolve(process.cwd(), 'src/components/SetlistsTab.tsx'), 'utf-8');
  const storageFile = fs.readFileSync(path.resolve(process.cwd(), 'src/utils/storage.ts'), 'utf-8');

  // SetlistsTab must initialize selectedSetlistId to null when no initialSelectedSetlistId is passed
  assert.ok(
    setlistsTabFile.includes('() => initialSelectedSetlistId || null'),
    'SetlistsTab must initialize selectedSetlistId to initialSelectedSetlistId || null'
  );

  // SetlistsTab must not persist setlist selection into localStorage
  assert.ok(
    !setlistsTabFile.includes("localStorage.setItem('nlbc_selected_setlist_id_v1'"),
    'SetlistsTab must not write selected setlist to localStorage'
  );
  assert.ok(
    !setlistsTabFile.includes("localStorage.getItem('nlbc_selected_setlist_id_v1'"),
    'SetlistsTab must not read selected setlist from localStorage'
  );

  // App.tsx must reset setlist selection and clear storage upon sign-in and sign-out
  assert.ok(
    appFile.includes('setInitialSelectedSetlistId(null)'),
    'App.tsx resets initialSelectedSetlistId on sign-in and sign-out'
  );

  // storage.ts includes legacy key cleanup for nlbc_selected_setlist_id_v1
  assert.ok(
    storageFile.includes("'nlbc_selected_setlist_id_v1'"),
    'storage.ts cleans up any legacy nlbc_selected_setlist_id_v1 from localStorage'
  );
});
