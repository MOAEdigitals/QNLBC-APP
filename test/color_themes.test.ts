import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { COLOR_THEMES, loadColorTheme, applyColorTheme } from '../src/utils/colorThemes.ts';
const dom = new JSDOM('', {url:'https://example.com'});
Object.assign(globalThis, {localStorage:dom.window.localStorage});

test('all four reference palettes apply, persist and remain valid when switching display mode',()=>{
 for(const theme of COLOR_THEMES) {
   const root=dom.window.document.documentElement;
   applyColorTheme(root,theme.id,'light');
   assert.equal(loadColorTheme(),theme.id);
   assert.equal(root.dataset.colorTheme,theme.id);
   assert.equal(root.style.getPropertyValue('--theme-button'),theme.base);
   assert.equal(root.style.getPropertyValue('--theme-button-text'),'#ffffff');
   applyColorTheme(root,theme.id,'dark');
   assert.equal(root.style.getPropertyValue('--theme-button'),theme.accent);
   assert.equal(root.style.getPropertyValue('--theme-button-text'),'#0f172a');
 }
});
test('default uses Corporate styling and invalid stored palettes fall back safely',()=>{
 const root=dom.window.document.documentElement;
 applyColorTheme(root,'retro','dark');
 applyColorTheme(root,'default','light');
 assert.equal(root.dataset.colorTheme,'default');
 assert.equal(root.style.getPropertyValue('--color-slate-900'),'');
 assert.equal(root.style.getPropertyValue('--ui-accent'),'#44749D');
 localStorage.setItem('qnlbc_color_theme','unknown');
 assert.equal(loadColorTheme(),'default');
});
test('settings is accessed through the profile and removed only from bottom navigation',()=>{
 const nav=readFileSync('src/components/BottomNav.tsx','utf8');
 assert.doesNotMatch(nav,/id: 'settings'/);
 for(const id of ['home','recognitions','special-numbers','songs','outlines']) assert.ok(nav.includes(`id: '${id}'`));
 const app=readFileSync('src/App.tsx','utf8');
 assert.match(app,/onNavigateToSettings=\{\(\) => handleNavigateTab\('settings'\)\}/);
 assert.match(app,/currentTab === 'settings'/);
});

test('personal palettes preserve neutral surfaces and neutral text',()=>{
 const root=dom.window.document.documentElement;
 // Simulate tokens left over by the previous implementation.
 root.style.setProperty('--color-slate-900','#18251d');
 root.style.setProperty('--ui-surface','#b7ff72');
 for(const theme of COLOR_THEMES) for(const mode of ['light','dark'] as const) {
   applyColorTheme(root,theme.id,mode);
   for(const token of ['--ui-surface','--ui-border','--theme-page',
     '--color-slate-50','--color-slate-500','--color-slate-900']) {
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
 for(const theme of COLOR_THEMES) for(const mode of ['light','dark'] as const) {
  applyColorTheme(dom.window.document.documentElement,theme.id,mode);
  const style=dom.window.document.documentElement.style;
  const a=luminance(style.getPropertyValue('--theme-button'));
  const b=luminance(style.getPropertyValue('--theme-button-text'));
  assert.ok((Math.max(a,b)+0.05)/(Math.min(a,b)+0.05)>=4.5,`${theme.id}/${mode}`);
 }
});

test('palette choices use the infographic schemes and fall back from retired palettes to Corporate',()=>{
 assert.deepEqual(COLOR_THEMES.map(theme=>theme.name),['Corporate (Default)','Zesty','Elegant','Retro']);
 for(const theme of COLOR_THEMES) assert.equal(theme.swatches.length,4);
 localStorage.setItem('qnlbc_color_theme','forest');
 assert.equal(loadColorTheme(),'default');
});

const { THEME_HUES, THEME_LEVELS, paletteScale, themeContrast } = await import('../src/utils/colorThemes.ts');
test('every palette recolors all chromatic families without tinting page surfaces',()=>{
 const root=dom.window.document.documentElement;
 for(const theme of COLOR_THEMES) for(const mode of ['light','dark'] as const) {
   applyColorTheme(root,theme.id,mode);
   for(const hue of THEME_HUES) for(const level of THEME_LEVELS) assert.match(root.style.getPropertyValue(`--color-${hue}-${level}`),/^#[0-9a-f]{6}$/);
   assert.equal(root.style.getPropertyValue('--color-slate-950'),'');
   assert.equal(root.style.getPropertyValue('--ui-surface'),'');
 }
 applyColorTheme(root,'default','light');
 const first=root.style.getPropertyValue('--color-purple-600');
 applyColorTheme(root,'retro','light');
 assert.notEqual(root.style.getPropertyValue('--color-purple-600'),first);
});
test('palette scales keep soft cards and readable foregrounds in Light and Dark modes',()=>{
 for(const theme of COLOR_THEMES) for(const seed of theme.swatches) {
   const scale=paletteScale(seed);
   assert.ok(themeContrast(scale[600],scale[50])>=4.5,`${theme.name}: light card text`);
   assert.ok(themeContrast(scale[300],scale[950])>=4.5,`${theme.name}: dark card text`);
   assert.ok(themeContrast(scale[500],'#ffffff')>=4.5,`${theme.name}: solid badge text`);
   assert.ok(themeContrast(scale[50],'#ffffff')<1.15,`${theme.name}: soft background`);
 }
});
