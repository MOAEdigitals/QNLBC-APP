import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { JSDOM } from 'jsdom';
import ts from 'typescript';

test('uncontrolled song pickers offer categories, cycle sorting and retain selection', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  const globals = ['window', 'document', 'navigator', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT'];
  const saved = globals.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  for (const key of globals) Object.defineProperty(globalThis, key, { configurable: true, value: key === 'IS_REACT_ACT_ENVIRONMENT' ? true : (dom.window as any)[key] });
  const require = createRequire(import.meta.url);
  const React = require('react');
  const { createRoot } = require('react-dom/client');
  const { act } = React;
  const exports: any = {};
  let selected = '';
  const root = createRoot(document.getElementById('root'));
  runInNewContext(ts.transpileModule(readFileSync('src/components/AutofillInput.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText, {
    exports, document, window: dom.window, CustomEvent: dom.window.CustomEvent, setTimeout, clearTimeout,
    ResizeObserver: class { observe() {} disconnect() {} },
    // Geometry is tested separately in picker_placement.test.ts.
    require: (name: string) => name === 'react' ? React : name === 'react-dom' ? require('react-dom') : name.includes('pickerPlacement') ? { pickerPlacement: () => ({ top: 144, maxHeight: 300 }) } : name.includes('songSearch') ? { fuzzyMatchString: () => ({ matches: false }), searchSong: () => ({ matches: true, score: 1 }), buildSongUsageMap: () => null } : new Proxy({}, { get: () => () => null }),
  });
  const songs = [{ id: 'z', title: 'Zion', category: 'Hymn' }, { id: 'a', title: 'Amazing Grace', category: 'Hymn' }, { id: 'b', title: 'Blessed', category: 'Choir' }];
  const titles = () => [...document.querySelectorAll('[class*="text-[14px]"]')].map(e => e.textContent);
  const click = async (button: Element) => act(() => (button as HTMLButtonElement).click());
  try {
    await act(() => root.render(React.createElement(exports.AutofillInput, { value: '', onChange: (value: string) => { selected = value; }, songs, suggestions: songs.map(s => s.title) })));
    document.querySelector('input')!.getBoundingClientRect = () => ({ top: 100, bottom: 144, left: 20, right: 370, width: 350, height: 44, x: 20, y: 100, toJSON() {} });
    await act(() => document.querySelector('input')!.dispatchEvent(new dom.window.FocusEvent('focusin', { bubbles: true })));
    assert.deepEqual(titles(), ['Zion', 'Amazing Grace', 'Blessed']);
    await click(document.querySelector('[aria-label^="Sort songs"]')!);
    assert.deepEqual(titles(), ['Amazing Grace', 'Blessed', 'Zion']);
    await click(document.querySelector('[aria-label^="Sort songs"]')!);
    assert.deepEqual(titles(), ['Zion', 'Blessed', 'Amazing Grace']);
    await click([...document.querySelectorAll('button')].find(b => b.textContent === 'Choir')!);
    assert.deepEqual(titles(), ['Blessed']);
    await click(document.querySelector('[class*="text-[14px]"]')!);
    assert.equal(selected, 'Blessed');
  } finally {
    await act(() => root.unmount()); dom.window.close();
    globals.forEach((key, index) => { if (saved[index]) Object.defineProperty(globalThis, key, saved[index]!); else delete (globalThis as any)[key]; });
  }
});
