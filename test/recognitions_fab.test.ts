import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const recognitions = source('../src/components/RecognitionsTab.tsx');
const songs = source('../src/components/SongsTab.tsx');

test('RecognitionsTab replaces top full-width add button with floating + action button at bottom right', () => {
  // Ensure top full-width button was removed from header
  assert.doesNotMatch(
    recognitions,
    /<button[^>]*className="w-full py-3 px-4 rounded-xl[^>]*>\s*<Plus[^>]*\/>\s*<span>\s*\{subTab === 'birthdays'/m,
    'Top full-width add button should be removed'
  );

  // Ensure floating action button (FAB) is present
  assert.match(
    recognitions,
    /fixed bottom-20.*right-4/,
    'Floating action button must have fixed bottom and right positioning'
  );

  assert.match(
    recognitions,
    /rounded-full.*shadow-xl/,
    'Floating action button must be circular with shadow styling'
  );

  // Ensure it triggers the active subTab modal
  assert.match(
    recognitions,
    /if \(subTab === 'birthdays'\) setIsAddingBirthday\(true\)/,
    'FAB must trigger Add Celebrant for birthdays'
  );
  assert.match(
    recognitions,
    /else if \(subTab === 'anniversaries'\) setIsAddingAnniversary\(true\)/,
    'FAB must trigger Add Anniversary for anniversaries'
  );
  assert.match(
    recognitions,
    /else if \(subTab === 'visitors'\) setIsAddingVisitor\(true\)/,
    'FAB must trigger Add Visitor for visitors'
  );
  assert.match(
    recognitions,
    /else if \(subTab === 'special'\) setIsAddingSpecial\(true\)/,
    'FAB must trigger Add Special Recognition for special'
  );

  // Ensure FAB styling matches SongsTab
  assert.match(
    songs,
    /fixed bottom-20 sm:bottom-22 right-4 sm:right-6 md:right-8 z-30 w-12 h-12 sm:w-14 sm:h-14 rounded-full/,
    'SongsTab has standard FAB positioning classes'
  );
  assert.match(
    recognitions,
    /fixed bottom-20 sm:bottom-22 right-4 sm:right-6 md:right-8 z-30 w-12 h-12 sm:w-14 sm:h-14 rounded-full/,
    'RecognitionsTab FAB matches SongsTab FAB positioning classes'
  );
});
