import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { createUiTestLoader } from './ui_test_components.ts';
import { confirmAction, currentAppDialog, resolveAppDialog } from '../src/services/appDialogs.ts';

test('shared pickers retain required validation, disabled choices, nested time selection and cancellation', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.com' });
  const keys = ['window', 'document', 'navigator', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT'];
  const previous = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  keys.forEach(key => Object.defineProperty(globalThis, key, { configurable: true, value: key === 'IS_REACT_ACT_ENVIRONMENT' ? true : (dom.window as any)[key] }));
  dom.window.matchMedia = (() => ({ matches: true })) as any;
  const ui = createUiTestLoader(dom, React), root = createRoot(document.getElementById('root')!);
  const { SheetSelect } = ui('SheetSelect'), { SheetDateField } = ui('SheetDateField');
  const changes: string[] = [];
  const click = async (el: Element) => { await act(async () => { (el as HTMLButtonElement).focus(); (el as HTMLButtonElement).click(); }); };
  const option = (text: string) => [...document.querySelectorAll('[role="dialog"]')].at(-1)!.querySelectorAll('button');
  const choose = async (text: string) => click([...option(text)].find(el => el.textContent === text)!);
  try {
    await act(async () => root.render(React.createElement('form', null,
      React.createElement(SheetSelect, { required: true, name: 'person', 'aria-label': 'Person', onChange: (e: any) => changes.push(e.target.value) },
        React.createElement('option', { value: '' }, 'Choose person'), React.createElement('option', { value: 'disabled', disabled: true }, 'Unavailable'), React.createElement('option', { value: 'roger' }, 'Roger')),
      React.createElement(SheetDateField, { type: 'time', value: '09:00', 'aria-label': 'Reminder time', onChange: (e: any) => changes.push(e.target.value) }))));
    await act(async () => { assert.equal(document.querySelector('form')!.checkValidity(), false); });
    assert.ok(document.querySelector('[role="dialog"]'), 'required field opens its picker');
    assert.equal([...option('')].find(el => el.textContent === 'Unavailable')!.disabled, true);
    await choose('Roger'); 
    assert.deepEqual(changes, ['roger']);
    assert.equal(document.querySelector('form')!.checkValidity(), true);
    await click(document.querySelector('[aria-label="Reminder time"]')!);
    await click(document.querySelector('[aria-label="Hour"]')!); await choose('12');
    await click(document.querySelector('[aria-label="AM or PM"]')!); await choose('AM');
    await choose('Set time'); assert.deepEqual(changes, ['roger', '00:00']);
    await click(document.querySelector('[aria-label="Reminder time"]')!);
    await act(async () => document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.equal(document.querySelector('[role="dialog"]'), null);
    assert.deepEqual(changes, ['roger', '00:00'], 'Escape does not commit a new value');
    assert.ok(document.activeElement === document.querySelector('[aria-label="Reminder time"]'), 'focus returns to the time trigger');
    await act(async () => root.render(React.createElement(SheetDateField, { type: 'date', value: '2026-11-08', 'aria-label': 'Scheduled date', onChange: (e: any) => changes.push(e.target.value) })));
    await click(document.querySelector('[aria-label="Scheduled date"]')!);
    const yearTrigger = document.querySelector('[aria-label="Calendar year"]')!;
    assert.equal(yearTrigger.textContent, '2026');
    assert.ok(yearTrigger.classList.contains('ui-calendar-year'), 'year has space reserved for all four digits');
    await click(yearTrigger);
    const years = [...document.querySelectorAll('[role="dialog"]')].at(-1)!.querySelectorAll<HTMLButtonElement>('.ui-sheet-option');
    const values = [...years].map(button => Number(button.textContent));
    assert.ok(values.every((year, index) => index === 0 || year < values[index - 1]), 'years run from latest to oldest');
    assert.ok([...years].find(button => button.textContent === '2026')?.getAttribute('aria-pressed') === 'true');
    await choose('2027');
    await click(document.querySelector('[aria-label="November 8, 2027"]')!);
    assert.equal(changes.at(-1), '2027-11-08', 'choosing a year updates the calendar without changing the month/day');

  } finally { await act(async () => root.unmount()); dom.window.close(); keys.forEach((key, i) => previous[i] ? Object.defineProperty(globalThis, key, previous[i]!) : delete (globalThis as any)[key]); }
});

test('confirmation queue cancels safely, rejects duplicate taps and ignores stale decisions', async () => {
  let writes = 0;
  const first = confirmAction('Delete test record?').then(accepted => { if (accepted) writes++; });
  const id = currentAppDialog()!.id;
  assert.equal(await confirmAction('Delete test record?'), false, 'double tap must not queue a second mutation');
  const second = confirmAction('Continue test action?');
  resolveAppDialog(id + 100, true); assert.equal(currentAppDialog()!.id, id);
  resolveAppDialog(id, false); await first; assert.equal(writes, 0);
  const next = currentAppDialog()!.id;
  resolveAppDialog(id, true); assert.equal(currentAppDialog()!.id, next);
  resolveAppDialog(next, true); assert.equal(await second, true); assert.equal(currentAppDialog(), null);
});
