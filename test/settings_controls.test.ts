import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { createUiTestLoader } from './ui_test_components.ts';

test('grouped settings retain destinations/admin visibility and switches expose state without submitting forms', async () => {
  const dom = new JSDOM('<div id="root"></div>');
  const keys = ['window', 'document', 'IS_REACT_ACT_ENVIRONMENT'];
  const old = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  keys.forEach(key => Object.defineProperty(globalThis, key, { configurable: true, value: key === 'IS_REACT_ACT_ENVIRONMENT' ? true : (dom.window as any)[key] }));
  const ui = createUiTestLoader(dom, React), { SettingsNavigation } = ui('SettingsNavigation'), { SwitchRow } = ui('SwitchRow');
  const root = createRoot(document.getElementById('root')!);
  const selected: string[] = []; const changes: boolean[] = [];
  try {
    await act(() => root.render(React.createElement(SettingsNavigation, { isAdmin: false, onSelect: (value: string) => selected.push(value) })));
    assert.deepEqual([...document.querySelectorAll('button')].map(button => button.textContent), ['My Account', 'Appearance']);
    await act(() => root.render(React.createElement(SettingsNavigation, { isAdmin: true, onSelect: (value: string) => selected.push(value) })));
    await act(() => { document.querySelectorAll('button').forEach(button => button.click()); });
    assert.deepEqual(selected, ['account', 'appearance', 'members', 'announcements', 'notificationSchedules', 'data']);
    let submits = 0;
    function Example({ disabled = false }: { disabled?: boolean }) {
      const [checked, setChecked] = React.useState(false);
      return React.createElement('form', { onSubmit: (event: React.FormEvent) => { event.preventDefault(); submits++; } },
        React.createElement(SwitchRow, { label: 'Notification sound', checked, disabled, onChange: (value: boolean) => { changes.push(value); setChecked(value); } }));
    }
    await act(() => root.render(React.createElement(Example)));
    const toggle = () => document.querySelector<HTMLButtonElement>('[role="switch"]')!;
    assert.equal(toggle().getAttribute('aria-checked'), 'false');
    assert.equal(toggle().textContent, 'Notification sound');
    await act(() => toggle().click()); assert.equal(toggle().getAttribute('aria-checked'), 'true');
    await act(() => toggle().click()); assert.deepEqual(changes, [true, false]); assert.equal(submits, 0);
    await act(() => root.render(React.createElement(Example, { disabled: true })));
    await act(() => toggle().click()); assert.deepEqual(changes, [true, false]);
  } finally {
    await act(() => root.unmount()); dom.window.close();
    keys.forEach((key, i) => { if (old[i]) Object.defineProperty(globalThis, key, old[i]!); else delete (globalThis as any)[key]; });
  }
});
