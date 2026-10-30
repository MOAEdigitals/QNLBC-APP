import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { JSDOM } from 'jsdom';
import ts from 'typescript';
import * as search from '../src/utils/songSearch.ts';

test('searched songs select on a fresh tap after scrolling; drags, cancellations and duplicate clicks do not select', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  const names = ['window', 'document', 'navigator', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT'];
  const saved = names.map(name => Object.getOwnPropertyDescriptor(globalThis, name));
  for (const name of names) Object.defineProperty(globalThis, name, { configurable: true, value: name === 'IS_REACT_ACT_ENVIRONMENT' ? true : (dom.window as any)[name] });
  const require = createRequire(import.meta.url), React = require('react'), { act } = React;
  const { createRoot } = require('react-dom/client');
  const NoResize = class { observe() {} disconnect() {} };
  dom.window.matchMedia = (() => ({ matches: true, addEventListener() {}, removeEventListener() {} })) as any;
  const exports: any = {};
  runInNewContext(ts.transpileModule(fs.readFileSync('src/components/AutofillInput.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, {
    exports, window: dom.window, document: dom.window.document, CustomEvent: dom.window.CustomEvent, ResizeObserver: NoResize, setTimeout, clearTimeout,
    require: (name: string) => name.includes('songSearch') ? search : name.includes('pickerPlacement') ? { pickerPlacement: () => ({ top: 100, maxHeight: 300 }) } : name.includes('useBackLayer') ? { useBackLayer() {} } : require(name),
  });
  const root = createRoot(document.getElementById('root'));
  const selected: string[] = [];
  const songs = [{ id: 'grace', title: 'Amazing Grace', lyrics: 'How sweet the sound' }, { id: 'thanks', title: 'Give Thanks', lyrics: 'With a grateful heart' }];
  function Harness() {
    const [value, setValue] = React.useState('');
    return React.createElement(exports.AutofillInput, { value, onChange: setValue, songs, suggestions: songs.map(s => s.title), showAllOnFocus: true, onSelectSuggestion: (title: string) => selected.push(title) });
  }
  function pointer(target: Element, type: string, y = 100) {
    const event = new dom.window.MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: 40, clientY: y });
    Object.defineProperties(event, { pointerId: { value: 1 }, pointerType: { value: 'touch' } });
    target.dispatchEvent(event);
  }
  async function openAndSearch() {
    const field = document.querySelector('input')!;
    await act(() => { pointer(field, 'pointerdown'); });
    await act(() => { pointer(field, 'pointerup'); });
    const input = document.querySelector<HTMLInputElement>('input[aria-label="Search songs"]')!;
    assert.ok(input, 'touch sheet opens');
    await act(() => input.click());
    await act(() => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(input, 'grace');
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    return [...document.querySelectorAll('[role="option"]')].find(row => row.textContent?.includes('Amazing Grace'))!;
  }
  try {
    await act(() => root.render(React.createElement(Harness)));
    let row = await openAndSearch(); assert.ok(row);
    await act(() => window.dispatchEvent(new dom.window.Event('scroll')));
    await act(() => { pointer(row, 'pointerdown'); pointer(row, 'pointerup'); row.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, detail: 1 })); });
    assert.deepEqual(selected, ['Amazing Grace'], 'fresh tap commits once even during the old scroll cooldown');
    row = await openAndSearch();
    await act(() => { pointer(row, 'pointerdown'); pointer(row, 'pointermove', 130); pointer(row, 'pointerup', 130); row.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, detail: 1 })); });
    assert.equal(selected.length, 1, 'drag cannot select');
    await act(() => { pointer(row, 'pointerdown'); pointer(row, 'pointercancel'); row.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, detail: 1 })); });
    assert.equal(selected.length, 1, 'cancelled scroll cannot select');
    await act(() => row.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    assert.equal(selected.length, 2, 'keyboard selection is not blocked by prior gestures');
  } finally {
    await act(() => root.unmount()); dom.window.close();
    names.forEach((name, i) => { if (saved[i]) Object.defineProperty(globalThis, name, saved[i]!); else delete (globalThis as any)[name]; });
  }
});
