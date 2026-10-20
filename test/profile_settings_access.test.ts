import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('settings is accessed through the profile and removed only from bottom navigation',()=>{
 const nav=readFileSync('src/components/BottomNav.tsx','utf8');
 assert.doesNotMatch(nav,/id: 'settings'/);
 for(const id of ['home','recognitions','special-numbers','songs','outlines']) assert.ok(nav.includes(`id: '${id}'`));
 const app=readFileSync('src/App.tsx','utf8');
 assert.match(app,/onNavigateToSettings=\{\(\) => handleNavigateTab\('settings'\)\}/);
 assert.match(app,/currentTab === 'settings'/);
});

