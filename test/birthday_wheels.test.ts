import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { createUiTestLoader } from './ui_test_components.ts';

test('birthday wheels wrap, clamp days, retain February 29, and cancel without saving', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.com' });
  const keys = ['window', 'document', 'navigator', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT'];
  const old = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  keys.forEach(key => Object.defineProperty(globalThis, key, { configurable: true, value: key === 'IS_REACT_ACT_ENVIRONMENT' ? true : (dom.window as any)[key] }));
  dom.window.matchMedia = (() => ({ matches: true })) as any;
  const { BirthdayDatePicker } = createUiTestLoader(dom, React)('BirthdayDatePicker');
  const root = createRoot(document.getElementById('root')!);
  const changes: string[] = [];
  const click = async (label: string) => act(() => (Array.from(document.querySelectorAll('button')).find(button => button.getAttribute('aria-label') === label || button.textContent === label) as HTMLButtonElement).click());
  const wheel = (label: string) => document.querySelector<HTMLElement>(`[role="spinbutton"][aria-label="Birthday ${label}"]`)!;
  const key = async (label: string, key: string) => act(() => wheel(label).dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })));
  try {
    await act(() => root.render(React.createElement(BirthdayDatePicker, { value: '2000-12-31', onChange: (date: string) => changes.push(date) })));
    assert.equal(document.querySelectorAll('#root button').length, 1, 'one combined birthday trigger');
    assert.equal(document.querySelector('#root button')!.textContent, 'December 31');
    await click('Birthday (month and day)');
    assert.equal(document.querySelectorAll('[role="dialog"]').length, 1);
    assert.equal(document.querySelectorAll('[role="spinbutton"]').length, 2, 'both wheels share one picker, with no year');
    await key('month', 'ArrowDown');
    assert.equal(wheel('month').getAttribute('aria-valuetext'), 'January');
    await key('day', 'ArrowDown'); assert.equal(wheel('day').getAttribute('aria-valuenow'), '1');
    await key('day', 'ArrowUp'); assert.equal(wheel('day').getAttribute('aria-valuenow'), '31');
    await key('month', 'ArrowDown'); assert.equal(wheel('day').getAttribute('aria-valuenow'), '29');
    await key('month', 'ArrowUp'); await key('day', 'End');
    await key('month', 'ArrowDown'); await click('Set birthday');
    assert.deepEqual(changes, ['2000-02-29']);
    await click('Birthday (month and day)'); await key('month', 'ArrowDown'); await click('Cancel');
    assert.equal(changes.length, 1);
    await click('Birthday (month and day)'); assert.equal(wheel('month').getAttribute('aria-valuetext'), 'December', 'cancelled draft does not replace the supplied value');
    // Commit immediately after scrolling, before the settling timer fires.
    const month = wheel('month'); month.scrollTop = (3 * 12 + 1) * 48;
    await act(() => month.dispatchEvent(new dom.window.Event('scroll', { bubbles: true })));
    await click('Set birthday'); assert.equal(changes.at(-1), '2000-02-29');
    await click('Birthday (month and day)');
    const day = wheel('day'); day.scrollTop = (3 * 31 + 31) * 48;
    await act(async () => { day.dispatchEvent(new dom.window.Event('scroll', { bubbles: true })); await new Promise(resolve => setTimeout(resolve, 150)); });
    assert.equal(wheel('day').getAttribute('aria-valuenow'), '1', 'scroll wraps past the last day');
    assert.equal(wheel('day').scrollTop, 3 * 31 * 48, 'the repeated list recenters away from its ends');
  } finally {
    await act(() => root.unmount()); dom.window.close();
    keys.forEach((key, i) => old[i] ? Object.defineProperty(globalThis, key, old[i]!) : delete (globalThis as any)[key]);
  }
});
