import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const setlists = source('../src/components/SetlistsTab.tsx');

test('SetlistsTab keeps all three names under the title without abbreviated role labels', () => {
  // Ensure the old ml-14 hack outside the header is gone
  assert.doesNotMatch(
    setlists,
    /ml-14 flex items-center gap-2 whitespace-nowrap text-slate-500/,
    'Redundant separate role summary with ml-14 outside header should be removed'
  );

  // Ensure role summary is nested inside min-w-0 flex-1 directly under the title h4
  assert.match(
    setlists,
    /<div className="min-w-0 flex-1">[\s\S]*?<h4[\s\S]*?<\/h4>[\s\S]*?className="setlist-people[\s\S]*?item.presider[\s\S]*?item.sundaySchool\?\.songLeader[\s\S]*?item.worshipService\?\.songLeader/,
    'Presider and both song leaders must remain in the title block alongside the calendar badge'
  );
  const summary = setlists.slice(setlists.indexOf('className="setlist-people'), setlists.indexOf('{/* Far-right actions */}'));
  assert.doesNotMatch(summary, /\b(?:P|SS|WS):/);
});
