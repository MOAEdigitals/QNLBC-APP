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

test('personal palettes preserve neutral surfaces, borders, text and semantic utility colors',()=>{
 const root=dom.window.document.documentElement;
 // Simulate tokens left over by the previous implementation.
 root.style.setProperty('--color-slate-900','#18251d');
 root.style.setProperty('--ui-surface','#b7ff72');
 for(const theme of COLOR_THEMES) for(const mode of ['light','dark'] as const) {
   applyColorTheme(root,theme.id,mode);
   for(const token of ['--ui-surface','--ui-border','--theme-page',
     '--color-slate-50','--color-slate-500','--color-slate-900','--color-blue-600','--color-indigo-600']) {
     assert.equal(root.style.getPropertyValue(token),'', `${theme.id}/${mode}: ${token}`);
   }
 }
 const css=readFileSync('src/index.css','utf8').split('/* Personal themes')[1];
 assert.doesNotMatch(css,/bg-white|theme-page|ui-surface/);
});
test('theme button text has readable contrast in every palette and display mode',()=>{
 function luminance(hex:string) {
  const c=hex.slice(1).match(/../g)!.map(v=>parseInt(v,16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);
  return c[0]*0.2126+c[1]*0.7152+c[2]*0.0722;
 }
 for(const theme of COLOR_THEMES.slice(1)) for(const mode of ['light','dark'] as const) {
  applyColorTheme(dom.window.document.documentElement,theme.id,mode);
  const style=dom.window.document.documentElement.style;
  const a=luminance(style.getPropertyValue('--theme-button'));
  const b=luminance(style.getPropertyValue('--theme-button-text'));
  assert.ok((Math.max(a,b)+0.05)/(Math.min(a,b)+0.05)>=4.5,`${theme.id}/${mode}`);
 }
});
