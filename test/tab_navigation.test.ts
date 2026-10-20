import test from 'node:test';
import assert from 'node:assert/strict';
import { initialAppTab } from '../src/utils/tabNavigation.ts';

test('first open with no tab and unknown URLs default to Schedules', () => {
  for (const hash of ['', '#', '#unknown', '#constructor', '#Songs']) {
    assert.equal(initialAppTab(hash), 'special-numbers');
  }
});

test('refresh preserves each main tab from its URL', () => {
  for (const tab of ['home', 'recognitions', 'special-numbers', 'songs', 'outlines', 'settings']) {
    assert.equal(initialAppTab(`#${tab}`), tab);
  }
});

test('Outlines is fifth in bottom navigation and absent from Schedules sections', async()=>{
 const {readFileSync}=await import('node:fs');
 const nav=readFileSync('src/components/BottomNav.tsx','utf8');
 const ids=[...nav.matchAll(/id: '([^']+)' as AppTab/g)].map(match=>match[1]);
 assert.deepEqual(ids,['home','recognitions','special-numbers','songs','outlines']);
 const schedules=readFileSync('src/components/SpecialNumberTab.tsx','utf8');
 assert.doesNotMatch(schedules,/setActiveSubTab\('outlines'\)|<SermonOutlines/);
 const app=readFileSync('src/App.tsx','utf8');
 assert.match(app,/currentTab === 'outlines' && <SermonOutlines currentUser=\{currentUser\} collapseSignal=\{collapseSignals.outlines\}/);
});
