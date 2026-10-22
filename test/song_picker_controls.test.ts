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

    // Touch browsing must not focus an editable field or change the saved value.
    const touch = async (input: Element, eventName: string, y = 100, x = 40) => act(() => {
      const event = new dom.window.Event(eventName, { bubbles: true, cancelable: true });
      Object.defineProperties(event, { pointerType: { value: 'touch' }, pointerId: { value: 1 }, button: { value: 0 }, clientX: { value: x }, clientY: { value: y } });
      input.dispatchEvent(event);
    });
    for (const kind of ['songs', 'names']) {
      selected = 'Original';
      await act(() => root.render(React.createElement(exports.AutofillInput, { key: kind, value: 'Original', onChange: (value: string) => { selected = value; }, ...(kind === 'songs' ? { songs, suggestions: songs.map(s => s.title) } : { suggestions: ['Bro Ronnie', 'Bro Joshua'] }) })));
      const input = document.querySelector('input')!;
      await touch(input, 'pointerdown');
      await touch(input, 'pointermove', 140);
      await touch(input, 'pointerup', 140);
      assert.equal(document.querySelector('[role="dialog"]'), null, 'scrolling past a field does not open the picker');
      await touch(input, 'pointerdown');
      await touch(input, 'pointerup');
      const dialog = document.querySelector('[role="dialog"]')!;
      assert.ok(dialog);
      const search = dialog.querySelector('input')!;
      assert.equal(search.readOnly, true);
      assert.notEqual(document.activeElement, search);
      assert.equal(selected, 'Original');
      assert.deepEqual(titles(), kind === 'songs' ? ['Zion', 'Amazing Grace', 'Blessed'] : ['Bro Ronnie', 'Bro Joshua']);
      if (kind === 'songs') {
        assert.ok(dialog.querySelector('[aria-label^="Sort songs"]')!.classList.contains('right-0'));
        await click(dialog.querySelector('[aria-label^="Sort songs"]')!);
        assert.deepEqual(titles(), ['Amazing Grace', 'Blessed', 'Zion']);
        assert.equal(search.readOnly, true, 'sorting does not activate the keyboard');
        await click(dialog.querySelector('[aria-label^="Sort songs"]')!);
        await click(dialog.querySelector('[aria-label^="Sort songs"]')!);
      }
      const header = dialog.querySelector('[data-picker-drag-header]')!;
      await touch(header, 'pointerdown', 200);
      await touch(header, 'pointermove', 180);
      await touch(header, 'pointerup', 180);
      assert.equal(dialog.getAttribute('data-picker-fullscreen'), 'false', 'short gestures snap back');
      await touch(header, 'pointerdown', 200);
      await touch(header, 'pointermove', 100, 200);
      await touch(header, 'pointerup', 100, 200);
      assert.equal(dialog.getAttribute('data-picker-fullscreen'), 'false', 'horizontal gestures are ignored');
      await touch(header, 'pointerdown', 200);
      await touch(header, 'pointermove', 100);
      await touch(header, 'pointercancel', 100);
      assert.equal(dialog.getAttribute('data-picker-fullscreen'), 'false', 'interrupted gestures do not expand');
      await touch(header, 'pointerdown', 200);
      await touch(header, 'pointermove', 100);
      await touch(header, 'pointerup', 100);
      assert.equal(dialog.getAttribute('data-picker-fullscreen'), 'true');
      assert.equal((dialog as HTMLElement).style.height, `${window.innerHeight}px`);
      assert.equal(search.readOnly, true, 'expanding does not activate the keyboard');
      const top = (dialog.parentElement as HTMLElement).style.top;
      await act(() => window.dispatchEvent(new dom.window.Event('resize')));
      assert.equal((dialog.parentElement as HTMLElement).style.top, top, 'sheet does not flip around the field');
      await click(search);
      assert.equal(search.readOnly, false);
      assert.equal(document.activeElement, search);
      await act(() => {
        Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(search, 'New custom name');
        search.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      });
      assert.equal(selected, 'Original', 'search is not an edit to the saved field');
      assert.ok([...dialog.querySelectorAll('button')].some(button => button.textContent === 'Use “New custom name”'), 'custom values remain available without committing the search');
      await click(dialog.querySelector('[aria-label="Close picker"]')!);
      assert.equal(selected, 'Original', 'closing discards the search');
      assert.equal(document.querySelector('[role="dialog"]'), null);
      await touch(input, 'pointerdown');
      await touch(input, 'pointerup');
      assert.equal(document.querySelector('[role="dialog"] input')!.getAttribute('value'), '');
      const reopened = document.querySelector('[role="dialog"]')!;
      assert.equal(reopened.getAttribute('data-picker-fullscreen'), 'false');
      const reopenedHeader = reopened.querySelector('[data-picker-drag-header]')!;
      await touch(reopenedHeader, 'pointerdown', 100);
      await touch(reopenedHeader, 'pointermove', 220);
      await touch(reopenedHeader, 'pointerup', 220);
      assert.equal(document.querySelector('[role="dialog"]'), null, 'swipe down closes without changing the field');
      assert.equal(selected, 'Original');
      await touch(input, 'pointerdown');
      await touch(input, 'pointerup');
      await click(document.querySelector('[class*="text-[14px]"]')!);
      assert.equal(selected, kind === 'songs' ? 'Zion' : 'Bro Ronnie');
      assert.equal(document.querySelector('[role="dialog"]'), null);
    }
  } finally {
    await act(() => root.unmount()); dom.window.close();
    globals.forEach((key, index) => { if (saved[index]) Object.defineProperty(globalThis, key, saved[index]!); else delete (globalThis as any)[key]; });
  }
});
