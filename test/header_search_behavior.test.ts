import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { JSDOM } from 'jsdom';
import ts from 'typescript';
import { useBackLayer } from '../src/hooks/useBackLayer.ts';

test('header search keeps filters visible outside, clears on Escape, and preserves tab searches until dismissed', async () => {
  const dom = new JSDOM('<div id="root"></div><button id="outside">Outside</button>', { url: 'http://localhost' });
  const globals = ['window', 'document', 'navigator', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT'];
  const saved = globals.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  for (const key of globals) Object.defineProperty(globalThis, key, { configurable: true, value: key === 'IS_REACT_ACT_ENVIRONMENT' ? true : (dom.window as any)[key] });
  const require = createRequire(import.meta.url);
  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const { act } = React;
  const exports: any = {};
  let search: any;
  let currentTab = 'songs';
  const root = createRoot(document.getElementById('root'));
  const render = () => root.render(React.createElement(exports.Navbar, { currentUser: null, currentTab, onNavigateToSettings() {} }));
  const config = (value: string, label = 'Search songs'): any => ({ value, label, placeholder: label, onChange: (next: string) => { search = config(next, label); render(); } });
  runInNewContext(ts.transpileModule(readFileSync('src/components/Navbar.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText, {
    exports, document, window: dom.window,
    require: (name: string) => name === 'react' ? React : name === '../hooks/useBackLayer' ? { useBackLayer } : name === './HeaderSearch' ? { useHeaderSearchContext: () => ({ search }) } : { ChurchLogo: () => null, Search: () => null, X: () => null },
  });
  const input = () => document.querySelector('input');
  const click = async (label: string) => act(() => document.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!.click());
  const outside = async () => act(() => document.getElementById('outside')!.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true })));
  const escape = async () => act(() => input()!.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
  try {
    search = config('');
    await act(render);
    await click('Search');
    assert.equal(document.activeElement, input(), 'explicit search opening focuses the input');
    await outside();
    assert.equal(input(), null, 'empty search may collapse on outside tap');
    await click('Search');
    await act(() => {
      const field = input()!;
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(field, 'Basics');
      field.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    assert.equal(search.value, 'Basics', 'typing updates the page filter');
    await outside();
    assert.equal(input()!.value, 'Basics');
    await escape();
    assert.equal(input(), null, 'Escape clears and collapses search');
    assert.equal(search.value, '');
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
    await act(() => { currentTab = 'settings'; search = null; render(); });
    assert.equal(input(), null);
    assert.equal(document.querySelector('[aria-label="Search"]'), null);
    await act(() => { currentTab = 'songs'; search = config('Basics'); render(); });
    assert.equal(input()!.value, 'Basics', 'returning to a filtered tab shows its query');
    assert.notEqual(document.activeElement, input(), 'returning does not force the keyboard open');
    await outside();
    assert.equal(input()!.value, 'Basics');
    await click('Clear search');
    assert.equal(search.value, '');
    assert.ok(input(), 'clearing leaves the field available to type again');
    assert.notEqual(document.activeElement, input(), 'clear does not force a dismissed keyboard open');
    await escape();
    assert.equal(input(), null, 'Escape closes empty search');
    await act(() => { search = config('Choir', 'Search choir songs'); render(); });
    assert.equal(input()!.value, 'Choir', 'subtab query is visible without an extra search tap');
    await outside();
    assert.equal(input()!.value, 'Choir');
    // IME dismissal leaves the query intact; the next browser/native Back owns search.
    await act(() => input()!.blur());
    assert.equal(search.value, 'Choir');
    let navigationPops = 0;
    const parent = () => navigationPops++;
    window.addEventListener('popstate', parent);
    await act(async () => { window.history.back(); await new Promise(resolve => setTimeout(resolve, 60)); });
    assert.equal(search.value, ''); assert.equal(input(), null);
    assert.equal(navigationPops, 0, 'closing search must not navigate to another tab');
    window.removeEventListener('popstate', parent);
  } finally {
    await act(() => root.unmount());
    dom.window.close();
    globals.forEach((key, index) => { if (saved[index]) Object.defineProperty(globalThis, key, saved[index]!); else delete (globalThis as any)[key]; });
  }
});
