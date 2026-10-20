import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { COLOR_THEMES, loadColorTheme, applyColorTheme } from '../src/utils/colorThemes.ts';
const dom = new JSDOM('', {url:'https://example.com'});
Object.assign(globalThis, {localStorage:dom.window.localStorage});

test('all seven reference palettes apply, persist and remain valid when switching display mode',()=>{
 for(const theme of COLOR_THEMES.slice(1)) {
   const root=dom.window.document.documentElement;
   applyColorTheme(root,theme.id,'light');
   assert.equal(loadColorTheme(),theme.id);
   assert.equal(root.dataset.colorTheme,theme.id);
   assert.equal(root.style.getPropertyValue('--theme-button'),theme.base);
   assert.equal(root.style.getPropertyValue('--theme-button-text'),'#ffffff');
   applyColorTheme(root,theme.id,'dark');
   assert.equal(root.style.getPropertyValue('--theme-button'),theme.accent);
   assert.equal(root.style.getPropertyValue('--theme-button-text'),theme.base);
 }
});
test('default restores original styling and invalid stored palettes fall back safely',()=>{
 const root=dom.window.document.documentElement;
 applyColorTheme(root,'forest','dark');
 applyColorTheme(root,'default','light');
 assert.equal(root.dataset.colorTheme,undefined);
 assert.equal(root.style.getPropertyValue('--color-slate-900'),'');
 assert.equal(root.style.getPropertyValue('--ui-accent'),'');
 localStorage.setItem('qnlbc_color_theme','unknown');
 assert.equal(loadColorTheme(),'default');
});
test('settings is accessed through the profile and removed only from bottom navigation',()=>{
 const nav=readFileSync('src/components/BottomNav.tsx','utf8');
 assert.doesNotMatch(nav,/id: 'settings'/);
 for(const id of ['home','recognitions','special-numbers','songs']) assert.ok(nav.includes(`id: '${id}'`));
 const app=readFileSync('src/App.tsx','utf8');
 assert.match(app,/onNavigateToSettings=\{\(\) => handleNavigateTab\('settings'\)\}/);
 assert.match(app,/currentTab === 'settings'/);
});
