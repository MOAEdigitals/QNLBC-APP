import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { createUiTestLoader } from './ui_test_components.ts';

test('rapid category choices save together once, retain failed drafts and block dismissal while saving', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.com' });
  const keys = ['window', 'document', 'navigator', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT'];
  const previous = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  keys.forEach(key => Object.defineProperty(globalThis, key, { configurable: true, value: key === 'IS_REACT_ACT_ENVIRONMENT' ? true : (dom.window as any)[key] }));
  dom.window.matchMedia = (() => ({ matches: true })) as any;
  const ui = createUiTestLoader(dom, React), { SongCategorySheet } = ui('SongCategorySheet');
  const root = createRoot(document.getElementById('root')!);
  const calls: string[][] = []; let closed = 0, finish: () => void = () => {}, fail = true;
  const button = (name: string) => [...document.querySelectorAll('button')].find(el => el.textContent === name)!;
  const click = async (element: HTMLButtonElement) => { await act(async () => element.click()); };
  try {
    await act(async () => root.render(React.createElement(SongCategorySheet, { categories: ['Tagalog', 'Contemporary', 'Hymn'], selected: [], onClose: () => closed++, onSave: async (categories: string[]) => { calls.push(categories); await new Promise<void>(resolve => { finish = resolve; }); if (fail) throw Error('Connection interrupted'); } })));
    await act(async () => { button('Tagalog').click(); button('Contemporary').click(); });
    assert.equal(calls.length, 0, 'category taps only edit the local draft');
    await act(async () => { button('Save categories').click(); button('Save categories')?.click(); });
    assert.deepEqual(Array.from(calls[0]), ['Tagalog', 'Contemporary']); assert.equal(calls.length, 1);
    assert.equal(document.querySelector('[aria-label="Close Song categories"]')!.hasAttribute('disabled'), true);
    await act(async () => document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.equal(closed, 0, 'Escape must not dismiss or hide the saving sheet');
    assert.equal(document.querySelector('.ui-bottom-sheet')!.hasAttribute('data-leaving'), false);
    await act(async () => finish());
    assert.ok(document.querySelector('[role="alert"]'));
    assert.equal(button('Tagalog').getAttribute('aria-pressed'), 'true');
    assert.equal(button('Contemporary').getAttribute('aria-pressed'), 'true');
    fail = false; await click(button('Save categories')); await act(async () => finish());
    assert.equal(calls.length, 2); assert.equal(closed, 1);
    await click(button('Cancel')); assert.equal(calls.length, 2, 'Cancel does not write');
  } finally { await act(async () => root.unmount()); dom.window.close(); keys.forEach((key, i) => previous[i] ? Object.defineProperty(globalThis, key, previous[i]!) : delete (globalThis as any)[key]); }
});
