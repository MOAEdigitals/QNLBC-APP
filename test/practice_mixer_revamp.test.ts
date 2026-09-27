import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const practiceTab = readFileSync('src/components/SpecialNumberTab.tsx', 'utf8');
const trackRow = readFileSync('src/components/PracticeAudioTrackRow.tsx', 'utf8');

test('saved practices present vocal and backing audio in one mixer', () => {
  assert.match(practiceTab, /Audio mixer/);
  assert.match(practiceTab, /No rehearsal audio yet/);
  assert.match(practiceTab, /handleOpenAddVocalPartModal\(group, undefined, 'record'\)/);
  assert.match(practiceTab, /handleOpenAddTrackModal\(group\)/);
});

test('audio mixer rows stay compact on mobile and expose icon controls', () => {
  assert.match(trackRow, /if \(normalized\.startsWith\('soprano'\)\) return 'S'/);
  assert.match(trackRow, /if \(normalized\.startsWith\('alto'\)\) return 'A'/);
  assert.match(trackRow, /aria-label=\{isCurrentlyPlaying \? 'Pause audio'/);
  assert.match(trackRow, /aria-label="Track options"/);
  assert.doesNotMatch(trackRow, />Actions<\/span>/);
});

test('practice creation saves new songs and captures rehearsal date and time', () => {
  assert.match(practiceTab, /if \(!matchedSong && onSaveSong && isNew\)/);
  assert.doesNotMatch(practiceTab, /if \(!matchedSong && onSaveSong && !isEditingPractice\)/);
  assert.match(practiceTab, /value=\{editingPractice\.practiceDate \|\| ''\}/);
  assert.match(practiceTab, /value=\{editingPractice\.practiceTime \|\| ''\}/);
  assert.match(practiceTab, /disabled=\{isSavingPractice\}[\s\S]*?Close practice form/);
});
