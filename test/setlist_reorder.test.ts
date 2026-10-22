import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { JSDOM } from 'jsdom';
import ts from 'typescript';
import * as ordering from '../src/utils/initialSetlistCard.ts';

test('shared positions stay inside their date and choose the first Today on startup only', () => {
  const rows = [{ id: 'b', date: '2026-10-22', displayOrder: 1, revision: 3 }, { id: 'other', date: '2026-10-23' }, { id: 'a', date: '2026-10-22', displayOrder: 0, revision: 2 }, { id: 'new', date: '2026-10-22' }];
  assert.deepEqual(ordering.orderSameDateSetlists(rows).map(row => row.id), ['a', 'other', 'b', 'new']);
  const move = ordering.sameDateSetlistMove(rows, 'new', 'a', 'before');
  assert.deepEqual(move.orderedIds, ['new', 'a', 'b']);
  assert.deepEqual(move.expectedRevisions, { a: 2, b: 3, new: 1 });
  assert.deepEqual(rows.map(row => row.id), ['b', 'other', 'a', 'new'], 'source data is immutable');
  assert.throws(() => ordering.sameDateSetlistMove(rows, 'a', 'other', 'after'));
  assert.equal(ordering.initialSetlistCardId(rows, '2026-10-22'), 'a');
  assert.equal(ordering.initialSetlistCardId(rows, '2026-10-22', null, []), null);
  assert.equal(ordering.initialSetlistCardId(rows, '2026-10-22', null, ['b']), 'b');
});

test('song handles require a hold, restrict the section, preserve row data and support keyboard reordering', async () => {
  const dom = new JSDOM('<div id="root"></div>');
  const keys = ['window', 'document', 'navigator', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT'];
  const saved = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  keys.forEach(key => Object.defineProperty(globalThis, key, { configurable: true, value: key === 'IS_REACT_ACT_ENVIRONMENT' ? true : (dom.window as any)[key] }));
  const require = createRequire(import.meta.url), React = require('react'), { act } = React;
  const root = require('react-dom/client').createRoot(document.getElementById('root'));
  let clock = 0, hit: Element | null = null, calls: any[] = [], fail = false;
  const exports: any = {};
  runInNewContext(ts.transpileModule(readFileSync('src/hooks/useSetlistReorder.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Error, window: dom.window, document, Date: { now: () => clock }, requestAnimationFrame: () => 1, cancelAnimationFrame() {},
    require: (name: string) => name === 'react' ? React : ordering,
  });
  (document as any).elementFromPoint = () => hit;
  const rows = [{ id: 'ss1', date: 'ss', displayOrder: 0, song: { title: 'First', songId: 'linked', notes: 'Keep this' } }, { id: 'ss2', date: 'ss', displayOrder: 1, song: { title: 'Second' } }, { id: 'ws1', date: 'ws', displayOrder: 0 }];
  function Harness() {
    const reorder = exports.useSetlistReorder(rows, async (...args: any[]) => { if (fail) throw new Error('Conflict: reload'); calls.push(args); }, true, { attribute: 'data-song-slot-id', holdDelay: 250, label: 'Songs' });
    return React.createElement('div', {}, rows.map(row => React.createElement('div', { key: row.id, 'data-song-slot-id': row.id }, React.createElement('button', { id: row.id, ...reorder.handleProps(row) }, row.id))), React.createElement('p', { role: 'alert' }, reorder.error));
  }
  const pointer = async (id: string, type: string, y = 0) => act(() => {
    const event = new dom.window.Event(type, { bubbles: true, cancelable: true });
    Object.defineProperties(event, { pointerId: { value: 1 }, pointerType: { value: 'touch' }, button: { value: 0 }, clientX: { value: 20 }, clientY: { value: y } });
    document.getElementById(id)!.dispatchEvent(event);
  });
  try {
    await act(() => root.render(React.createElement(Harness)));
    hit = document.getElementById('ss2');
    await pointer('ss1', 'pointerdown'); clock += 50; await pointer('ss1', 'pointermove', 20); await pointer('ss1', 'pointerup', 20);
    assert.equal(calls.length, 0, 'early movement cancels a hold');
    await pointer('ss1', 'pointerdown'); clock += 300; await pointer('ss1', 'pointermove', 30); await pointer('ss1', 'pointerup', 30);
    assert.deepEqual(Array.from(calls[0][1]), ['ss2', 'ss1']);
    assert.equal(rows[0].song!.notes, 'Keep this');
    hit = document.getElementById('ws1');
    await pointer('ss1', 'pointerdown'); clock += 300; await pointer('ss1', 'pointermove', 30); await pointer('ss1', 'pointerup', 30);
    assert.equal(calls.length, 1, 'cross-section drops are ignored');
    hit = document.getElementById('ss2');
    await pointer('ss1', 'pointerdown'); clock += 300; await pointer('ss1', 'pointermove', 30); await pointer('ss1', 'pointercancel'); await pointer('ss1', 'pointerup');
    assert.equal(calls.length, 1, 'cancel never saves');
    await act(() => document.getElementById('ss1')!.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
    assert.equal(calls.length, 2);
    fail = true;
    await act(() => document.getElementById('ss1')!.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
    assert.equal(document.querySelector('[role="alert"]')!.textContent, 'Conflict: reload');
  } finally {
    await act(() => root.unmount()); dom.window.close();
    keys.forEach((key, index) => { if (saved[index]) Object.defineProperty(globalThis, key, saved[index]!); else delete (globalThis as any)[key]; });
  }
});
