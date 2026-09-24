import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const setlists = source('../src/components/SetlistsTab.tsx');

test('SetlistsTab balances header layout: P, SS, WS line is placed under the title alongside the calendar badge', () => {
  // Ensure the old ml-14 hack outside the header is gone
  assert.doesNotMatch(
    setlists,
    /ml-14 flex items-center gap-2 whitespace-nowrap text-slate-500/,
    'Redundant separate role summary with ml-14 outside header should be removed'
  );

  // Ensure role summary is nested inside min-w-0 flex-1 directly under the title h4
  assert.match(
    setlists,
    /<div className="min-w-0 flex-1">[\s\S]*?<h4[\s\S]*?<\/h4>[\s\S]*?P:\s*<span[\s\S]*?SS:[\s\S]*?WS:/,
    'Role summary (P, SS, WS) must be placed directly inside the title block alongside the calendar badge'
  );
});
