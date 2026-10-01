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

test('practice creation saves new songs without exposing a separate practice date or time', () => {
  assert.match(practiceTab, /if \(!matchedSong && onSaveSong && isNew\)/);
  assert.doesNotMatch(practiceTab, /if \(!matchedSong && onSaveSong && !isEditingPractice\)/);
  assert.doesNotMatch(practiceTab, /value=\{editingPractice\.practiceDate \|\| ''\}/);
  assert.doesNotMatch(practiceTab, /value=\{editingPractice\.practiceTime \|\| ''\}/);
  assert.doesNotMatch(practiceTab, /1\. Choose the song and practice details/);
  assert.match(practiceTab, /disabled=\{isSavingPractice\}[\s\S]*?Close practice form/);
});

test('saved practice cards open from the whole card and use icon-only header controls', () => {
  assert.match(practiceTab, /if \(!isSelected\) setSelectedPracticeId\(group\.id\)/);
  assert.match(practiceTab, /aria-label="Practice actions"/);
  assert.match(practiceTab, /aria-label="Close practice"/);
  assert.doesNotMatch(practiceTab, />Open<\/button>/);
  assert.doesNotMatch(practiceTab, /<summary>Actions<\/summary>/);
  assert.doesNotMatch(practiceTab, /← All practices/);
});

test('practice header keeps controls fixed while long titles and badges wrap on the left', () => {
  assert.match(practiceTab, /grid grid-cols-\[minmax\(0,1fr\)_auto\] items-center gap-3/);
  assert.match(practiceTab, /line-clamp-2 break-words text-base font-black leading-tight/);
  assert.match(practiceTab, /mt-2 flex flex-wrap items-center gap-x-1\.5 gap-y-1/);
  assert.match(practiceTab, /<div className="flex shrink-0 items-center gap-1">/);
});

test('opened practice keeps lyrics expanded and hides its new-practice FAB', () => {
  assert.doesNotMatch(practiceTab, /View lyrics/);
  assert.doesNotMatch(practiceTab, /expandedLyricsGroupIds/);
  assert.match(practiceTab, /max-h-none overflow-visible whitespace-pre-wrap/);
  assert.match(practiceTab, /!\(activeSubTab === 'practice' && selectedPracticeId\)/);
});
