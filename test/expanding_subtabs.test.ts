import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8').replace(/\r\n/g, '\n');

test('Schedules keeps every subtab label visible on one line on mobile', () => {
  const source = read('src/components/SpecialNumberTab.tsx');
  const styles = read('src/index.css');
  assert.match(source, /aria-label="Schedules sections" className="app-subtabs/);
  assert.match(source, /'Activities',[\s\S]*?'Song Numbers',[\s\S]*?'Choir',[\s\S]*?'Practice',/);
  assert.match(source, /aria-pressed=\{activeSubTab === key\}/);
  assert.match(styles, /\.app-subtab-label \{ white-space: nowrap; \}/);
  assert.doesNotMatch(styles, /\[aria-pressed="true"\] \.app-subtab-label/);
  assert.doesNotMatch(source, /\{ schedules: 'Song Numbers', practice: 'Practice'/);
  assert.doesNotMatch(styles, /\.practice-screen > div:first-child > button/);
});

test('Schedules opens Activities as its default subtab', () => {
  const source = read('src/components/SpecialNumberTab.tsx');
  assert.match(source, /useSwipeSubtabs<SpecialNumbersSubTab>\('special-numbers', 'activities'\)/);
});

test('main and recognition navigation do not render numeric bubbles', () => {
  const bottomNav = read('src/components/BottomNav.tsx');
  const recognitions = read('src/components/RecognitionsTab.tsx');
  assert.doesNotMatch(bottomNav, /tab\.badge|celebrantCount|upcomingSpecialCount/);
  assert.doesNotMatch(recognitions, /absolute right-0 top-0 sm:static/);
});

test('Recognitions keeps every subtab label visible on mobile', () => {
  const source = read('src/components/RecognitionsTab.tsx');
  assert.match(source, /aria-label="Recognitions sections" className="app-subtabs/);
  assert.match(source, /aria-pressed=\{subTab === key\}/);
  assert.match(source, /className="app-subtab-label"/);
  assert.doesNotMatch(source, /aria-label="Visitors"/);
});
