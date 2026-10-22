import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { JSDOM } from 'jsdom';
import ts from 'typescript';
import * as dates from '../src/utils/dateUtils.ts';
import * as colors from '../src/utils/personColors.ts';

test('setlists remain expanded through tab remounts, other cards and navigation reselect', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/#home' });
  const keys = ['window', 'document', 'navigator', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT'];
  const saved = keys.map(k => Object.getOwnPropertyDescriptor(globalThis, k));
  for (const k of keys) Object.defineProperty(globalThis, k, { configurable: true, value: k === 'IS_REACT_ACT_ENVIRONMENT' ? true : (dom.window as any)[k] });
  const require = createRequire(import.meta.url), React = require('react');
  const { act } = React, root = require('react-dom/client').createRoot(document.getElementById('root'));
  dom.window.scrollTo = () => {};
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  let remembered: string[] = [];
  const compile = (file: string, dependencies: any) => {
    const exports: any = {};
    runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, {
      exports, window: dom.window, document: dom.window.document, sessionStorage: dom.window.sessionStorage, setTimeout, clearTimeout,
      requestAnimationFrame: () => 1, cancelAnimationFrame() {},
      require: (name: string) => name === 'react' ? React : dependencies[name] || new Proxy({}, { get: () => () => null }),
    });
    return exports;
  };
  const months = compile('src/components/MonthSeparators.tsx', {});
  const component = compile('src/components/SetlistsTab.tsx', { './MonthSeparators': months, '../utils/dateUtils': dates, '../utils/personColors': colors, '../utils/storage': { getAllDirectoryNames: () => [] } }).SetlistsTab;
  const rows = ['one', 'two'].map((id, index) => ({ id, date: `2026-10-${25 + index}`, type: 'sunday', sundaySchool: { songs: [] }, worshipService: { songs: [] } }));
  const render = (signal = 0, fresh = false) => root.render(React.createElement(component, { setlists: rows, songs: [], initialExpandedSetlistIds: fresh ? [] : remembered, collapseSignal: signal, onExpandedSetlistsChange: (ids: string[]) => { remembered = ids; }, onSaveSetlist: async () => true, onDeleteSetlist() {}, onOpenSongDetail() {} }));
  const clickHeader = async (id: string) => act(() => document.querySelector<HTMLDivElement>(`#setlist-card-${id} > div`)!.click());
  const open = (id: string) => document.querySelector(`#setlist-card-${id}`)!.children.length > 1;
  try {
    await act(() => render());
    assert.ok(document.getElementById('setlist-card-one'), document.body.innerHTML.slice(0, 3000));
    await clickHeader('one'); await clickHeader('two');
    assert.equal(open('one'), true); assert.equal(open('two'), true);
    await act(() => document.getElementById('setlist-card-one')!.click());
    assert.equal(open('one'), true, 'only the header toggles expansion');
    await act(() => root.render(null));
    await act(() => render(1));
    assert.equal(open('one'), true); assert.equal(open('two'), true);
    await act(() => render(2)); assert.equal(open('two'), true);
    await clickHeader('one'); assert.equal(open('one'), false); assert.equal(open('two'), true);
    await act(() => root.render(null)); await act(() => render(0, true));
    assert.equal(open('one'), false); assert.equal(open('two'), false);
  } finally {
    await act(() => root.unmount()); dom.window.close();
    keys.forEach((k, i) => { if (saved[i]) Object.defineProperty(globalThis, k, saved[i]!); else delete (globalThis as any)[k]; });
  }
});
