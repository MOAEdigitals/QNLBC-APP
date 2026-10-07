import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8').replace(/\r\n/g, '\n');

test('Schedules keeps every subtab one tap away and labels only the selected item on mobile', () => {
  const source = read('src/components/SpecialNumberTab.tsx');
  const styles = read('src/index.css');
  assert.match(source, /aria-label="Schedules sections" className="flex gap-1\.5/);
  assert.match(source, /activeSubTab === 'schedules' \? 'flex-1' : 'w-11 shrink-0'/);
  assert.match(source, /activeSubTab === 'practice' \? 'flex-1' : 'w-11 shrink-0'/);
  assert.match(source, /activeSubTab === tab \? 'inline' : 'hidden'/);
  assert.match(source, /\(\['activities', 'outlines'\] as const\)\.map[\s\S]*?aria-label="Song Numbers"[\s\S]*?aria-label="Choir"[\s\S]*?aria-label="Practice"/);
  assert.doesNotMatch(source, /\{ schedules: 'Song Numbers', practice: 'Practice'/);
  assert.doesNotMatch(styles, /\.practice-screen > div:first-child > button/);
});

test('main and recognition navigation do not render numeric bubbles', () => {
  const bottomNav = read('src/components/BottomNav.tsx');
  const recognitions = read('src/components/RecognitionsTab.tsx');
  assert.doesNotMatch(bottomNav, /tab\.badge|celebrantCount|upcomingSpecialCount/);
  assert.doesNotMatch(recognitions, /absolute right-0 top-0 sm:static/);
});

test('Recognitions keeps every subtab one tap away and labels only the selected item on mobile', () => {
  const source = read('src/components/RecognitionsTab.tsx');
  assert.match(source, /recognition-tabs flex gap-1\.5/);
  assert.match(source, /subTab === 'birthdays' \? 'flex-1' : 'w-11 shrink-0'/);
  assert.match(source, /subTab === 'visitors' \? 'inline' : 'hidden'/);
});
