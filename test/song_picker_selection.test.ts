import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { JSDOM } from 'jsdom';
import ts from 'typescript';
import * as search from '../src/utils/songSearch.ts';
import * as tracks from '../src/utils/songTracks.ts';

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
    require: (name: string) => name.includes('songSearch') ? search : name.includes('songTracks') ? tracks : name.includes('pickerPlacement') ? { pickerPlacement: () => ({ top: 100, maxHeight: 300 }) } : name.includes('useBackLayer') ? { useBackLayer() {} } : require(name),
  });
  const root = createRoot(document.getElementById('root'));
  const selected: string[] = [];
  const songs = [
    { id: 'grace', title: 'Amazing Grace', lyrics: 'How sweet the sound', categories: [' '], createdAt: '2020-01-01' },
    { id: 'thanks', title: 'Give Thanks', lyrics: 'With a grateful heart', categories: [], category: 'Hymn' },
    { id: 'zulu', title: 'Zulu Grace', lyrics: '', categories: ['Hymn'], minusOneLink: 'https://example.com/track', createdAt: '2021-01-01' },
    { id: 'alpha', title: 'Alpha Grace', lyrics: '', categories: ['Choir'], createdAt: '2022-01-01' },
  ];
  const setlists = [{ date: '2020-01-01', welcomeSong: 'Amazing Grace' }, { date: '2021-01-01', welcomeSong: 'Zulu Grace' }];
  function Harness() {
    const [value, setValue] = React.useState('');
    return React.createElement(exports.AutofillInput, { value, onChange: setValue, songs, setlists, suggestions: songs.map(s => s.title), showAllOnFocus: true, onSelectSuggestion: (title: string) => selected.push(title) });
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
    const titles = () => [...document.querySelectorAll('[role="option"]')].map(row => row.textContent?.split('Last sung')[0]);
    const sort = document.querySelector<HTMLSelectElement>('select[aria-label="Sort songs"]')!;
    assert.equal(sort.options.length, 7, 'all six library sorts plus relevance are offered');
    async function sortBy(value: string, firstTitle: string) {
      await act(() => { sort.value = value; sort.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
      assert.ok(titles()[0]?.startsWith(firstTitle), `${value} orders matching songs correctly`);
    }
    await sortBy('az', 'Alpha Grace');
    await sortBy('za', 'Zulu Grace');
    await sortBy('tracks-first', 'Zulu Grace');
    await sortBy('recently-added', 'Alpha Grace');
    await sortBy('recently-sung', 'Zulu Grace');
    await sortBy('least-recently-sung', 'Alpha Grace');
    const filter = (label: string) => [...document.querySelectorAll('button')].find(button => button.textContent === label)!;
    await act(() => filter('Uncategorized').click());
    assert.equal(titles().length, 1, 'only uncategorized songs match the filter');
    assert.ok(titles()[0]?.startsWith('Amazing Grace'));
    await act(() => filter('Hymn').click());
    const searchInput = document.querySelector<HTMLInputElement>('input[aria-label="Search songs"]')!;
    await act(() => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(searchInput, '');
      searchInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    assert.equal(titles().length, 2, 'legacy category remains categorized even when categories array is empty');
    await act(() => filter('All').click());
    await sortBy('relevance', 'Amazing Grace');
    row = [...document.querySelectorAll('[role="option"]')].find(row => row.textContent?.includes('Amazing Grace'))!;
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
