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
  assert.match(trackRow, /onClick=\{handleTogglePlay\}[\s\S]*?aria-label=\{`\$\{isCurrentlyPlaying \? 'Pause' : 'Play'\} \$\{badgeLabel\} track`\}/);
  assert.match(trackRow, /aria-label="Track options"/);
  assert.doesNotMatch(trackRow, /id=\{`play-btn-\$\{id\}`\}/);
  assert.doesNotMatch(trackRow, />Actions<\/span>/);
});

test('mixer uses one-line waveform rows without visible performer names or a lower player', () => {
  assert.match(trackRow, /const waveformBars = Array\.from\(\{ length: 36 \}/);
  assert.match(trackRow, /aria-label=\{`Seek \$\{badgeLabel\} track`\}/);
  assert.doesNotMatch(trackRow, /\{performerName\}\s*<\/h5>/);
  assert.doesNotMatch(trackRow, /id=\{`loop-btn-\$\{id\}`\}/);
});

test('practice details do not render a second expanded audio player below the mixer', () => {
  assert.doesNotMatch(practiceTab, /InlinePracticeAudioPlayer/);
  assert.doesNotMatch(practiceTab, /activeInlineTrack/);
});

test('track saves use a synchronous lock and a stable id so double taps and retries are idempotent', () => {
  assert.match(practiceTab, /const savingTrackRef = useRef\(false\)/);
  assert.match(practiceTab, /trackSubmissionIdRef\.current = generateUUID\(\)/);
  assert.match(practiceTab, /savingTrackRef\.current\) return/);
  assert.match(practiceTab, /disabled=\{isUploadingCloudMedia \|\| isSavingTrack \|\| !trackUrlOrData\.trim\(\)\}/);
  assert.match(practiceTab, /<span>\{isSavingTrack \? 'Saving…' : 'Syncing Cloud\.\.\.'\}<\/span>/);
  assert.doesNotMatch(practiceTab, /Track saved\./);
  assert.doesNotMatch(practiceTab, /trackSaveNotice/);
});

test('practice creation saves new songs and captures rehearsal date and time', () => {
  assert.match(practiceTab, /if \(!matchedSong && onSaveSong && isNew\)/);
  assert.doesNotMatch(practiceTab, /if \(!matchedSong && onSaveSong && !isEditingPractice\)/);
  assert.match(practiceTab, /value=\{editingPractice\.practiceDate \|\| ''\}/);
  assert.match(practiceTab, /value=\{editingPractice\.practiceTime \|\| ''\}/);
  assert.match(practiceTab, /disabled=\{isSavingPractice\}[\s\S]*?Close practice form/);
});

test('practice card header is clickable to open, has no open button, and uses 3-dots menu', () => {
  assert.doesNotMatch(practiceTab, />Open<\/button>/);
  assert.doesNotMatch(practiceTab, /<summary>Actions<\/summary>/);
  assert.match(practiceTab, /onClick=\{[^{}]*?setSelectedPracticeId\(isSelected \? null : group\.id\)/);
  assert.match(practiceTab, /aria-label=\{`Options for \$\{group\.songTitle\}`\}/);
  assert.match(practiceTab, /<MoreVertical className="w-5 h-5"/);
  assert.match(practiceTab, /handleTogglePracticeDone/);
  assert.match(practiceTab, /Edit practice/);
  assert.match(practiceTab, /Delete practice/);
});
