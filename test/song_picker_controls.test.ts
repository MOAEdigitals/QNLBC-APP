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
    require: (name: string) => name === 'react' ? React : name === 'react-dom' ? require('react-dom') : name === 'lucide-react' ? new Proxy({}, { get: () => (props: any) => React.createElement('svg', props) }) : name.includes('pickerPlacement') ? { pickerPlacement: () => ({ top: 144, maxHeight: 300 }) } : name.includes('songSearch') ? { fuzzyMatchString: () => ({ matches: false }), searchSong: () => ({ matches: true, score: 1 }), buildSongUsageMap: () => null } : new Proxy({}, { get: () => () => null }),
  });
  const songs = [{ id: 'z', title: 'Zion', category: 'Hymn' }, { id: 'a', title: 'Amazing Grace', category: 'Hymn', isStarred: true }, { id: 'b', title: 'Blessed', category: 'Choir' }];
  const titles = () => [...document.querySelectorAll('[class*="text-[14px]"]')].map(e => e.textContent);
  const markedTitles = () => [...document.querySelectorAll('[aria-label="Selected in this setlist"]')].map(element => element.parentElement!.textContent);
  const settleClose = async () => act(async () => { await new Promise(resolve => setTimeout(resolve, 280)); });
  const click = async (button: Element) => { await act(() => (button as HTMLButtonElement).click()); if (document.querySelector('[data-picker-closing]')) await settleClose(); };
  try {
    const renderDesktop = (selectedSongTitles: string[]) => root.render(React.createElement(exports.AutofillInput, { value: '', onChange: (value: string) => { selected = value; }, songs, suggestions: songs.map(s => s.title), selectedSongTitles }));
    await act(() => renderDesktop([' amazing GRACE ']));
    document.querySelector('input')!.getBoundingClientRect = () => ({ top: 100, bottom: 144, left: 20, right: 370, width: 350, height: 44, x: 20, y: 100, toJSON() {} });
    await act(() => document.querySelector('input')!.dispatchEvent(new dom.window.FocusEvent('focusin', { bubbles: true })));
    assert.deepEqual(titles(), ['Zion', 'Amazing Grace', 'Blessed']);
    assert.deepEqual(markedTitles(), ['Amazing Grace'], 'selected markers ignore case and surrounding spaces');
    const checkedTitle = document.querySelector('[aria-label="Selected in this setlist"]')!.parentElement!;
    assert.equal(checkedTitle.firstElementChild!.textContent, 'Amazing Grace');
    assert.equal(checkedTitle.nextElementSibling!.getAttribute('aria-label'), 'Starred', 'check is beside the title, before the separate star');
    await act(() => renderDesktop(['Zion']));
    assert.deepEqual(markedTitles(), ['Zion'], 'unsaved changes in another field update open pickers');
    await act(() => renderDesktop([]));
    assert.deepEqual(markedTitles(), [], 'removing the last use clears its marker');
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
      await act(() => root.render(React.createElement(exports.AutofillInput, { key: kind, value: 'Original', onChange: (value: string) => { selected = value; }, ...(kind === 'songs' ? { songs, suggestions: songs.map(s => s.title), selectedSongTitles: [' Zion '] } : { suggestions: ['Bro Ronnie', 'Bro Joshua'] }) })));
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
      assert.deepEqual(markedTitles(), kind === 'songs' ? ['Zion'] : [], 'mobile song lists show markers without changing name pickers');
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
      assert.ok(document.querySelector('[data-picker-closing]'), 'sheet stays mounted during its exit animation');
      assert.equal((reopened as HTMLElement).style.transform, 'translateY(100%)');
      await settleClose();
      assert.equal(document.querySelector('[role="dialog"]'), null, 'swipe down closes without changing the field');
      assert.equal(selected, 'Original');
      await touch(input, 'pointerdown');
      await touch(input, 'pointerup');
      await click(document.querySelector('[class*="text-[14px]"]')!);
      assert.equal(selected, kind === 'songs' ? 'Zion' : 'Bro Ronnie');
      assert.equal(document.querySelector('[role="dialog"]'), null);
    }

    for (const current of ['Napakaligaya', 'Give Thanks', 'Previously selected theme']) {
      selected = current;
      await act(() => root.render(React.createElement(exports.AutofillInput, { key: current, value: current, defaultValue: current === 'Previously selected theme' ? undefined : current, onChange: (value: string) => { selected = value; }, songs, suggestions: songs.map(song => song.title), showAllOnFocus: true })));
      const field = document.querySelector('input')!;
      field.getBoundingClientRect = () => ({ top: 100, bottom: 144, left: 20, right: 370, width: 350, height: 44, x: 20, y: 100, toJSON() {} });
      await act(() => field.dispatchEvent(new dom.window.FocusEvent('focusin', { bubbles: true })));
      assert.deepEqual(titles(), ['Zion', 'Amazing Grace', 'Blessed'], 'saved/default songs do not become browse queries');
      assert.equal(selected, current, 'browsing does not overwrite the default');
      await click([...document.querySelectorAll('button')].find(button => button.textContent === 'Choir')!);
      assert.deepEqual(titles(), ['Blessed']);
      await act(() => field.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
      await click(field);
      assert.deepEqual(titles(), ['Zion', 'Amazing Grace', 'Blessed'], 'reopening resets to All even while the field retains focus');
      await act(() => field.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
      await touch(field, 'pointerdown'); await touch(field, 'pointerup');
      assert.deepEqual(titles(), ['Zion', 'Amazing Grace', 'Blessed']);
      assert.equal(document.querySelector<HTMLTextAreaElement>('[role="dialog"] input')!.value, '', 'mobile browse query is empty even when a saved value exists');
      await click([...document.querySelectorAll('button')].find(button => button.textContent === 'Choir')!);
      await click(document.querySelector('[aria-label="Close picker"]')!);
      await touch(field, 'pointerdown'); await touch(field, 'pointerup');
      assert.deepEqual(titles(), ['Zion', 'Amazing Grace', 'Blessed'], 'mobile reopen resets to All');
      assert.equal(selected, current);
      await click(document.querySelector('[aria-label="Close picker"]')!);
    }
  } finally {
    await act(() => root.unmount()); dom.window.close();
    globals.forEach((key, index) => { if (saved[index]) Object.defineProperty(globalThis, key, saved[index]!); else delete (globalThis as any)[key]; });
  }
});
