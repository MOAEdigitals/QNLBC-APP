import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file: string) => readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

test('shared header replaces branding and profile with the active contextual search', () => {
  const navbar = read('src/components/Navbar.tsx');
  assert.match(navbar, /isSearching && search \? \(/);
  assert.match(navbar, /aria-label="Search"/);
  assert.match(navbar, /aria-label="Close search"/);
  assert.match(navbar, /inputRef\.current\?\.focus\(\)/);
  assert.doesNotMatch(navbar, /currentUser\.displayName \|\| currentUser\.username\}\s*<\/span>/);
});

test('existing page searches register with the shared header instead of rendering local search inputs', () => {
  for (const file of [
    'src/components/SetlistsTab.tsx',
    'src/components/RecognitionsTab.tsx',
    'src/components/SongsTab.tsx',
    'src/components/SpecialNumberTab.tsx',
    'src/components/SettingsTab.tsx',
    'src/features/activities/Activities.tsx',
    'src/features/sermons/SermonOutlines.tsx',
  ]) assert.match(read(file), /useHeaderSearch/);

  const combined = [
    'src/components/SetlistsTab.tsx',
    'src/components/RecognitionsTab.tsx',
    'src/components/SongsTab.tsx',
    'src/components/SpecialNumberTab.tsx',
    'src/components/SettingsTab.tsx',
    'src/features/sermons/SermonOutlines.tsx',
  ].map(read).join('\n');
  assert.doesNotMatch(combined, /type="search"/);
});
