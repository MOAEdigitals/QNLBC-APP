import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { installInputAssistance } from '../src/utils/inputAssistance.ts';

test('saved-entry suggestions are disabled for initial fields, future modal fields, and refocused fields', async () => {
  const dom = new JSDOM('<form><input autocomplete="username"><input type="password" autocomplete="current-password"></form>');
  const previous = { Element: globalThis.Element, MutationObserver: globalThis.MutationObserver };
  Object.assign(globalThis, { Element: dom.window.Element, MutationObserver: dom.window.MutationObserver });
  const doc = dom.window.document;
  const cleanup = installInputAssistance(doc);
  try {
    assert.equal(doc.querySelector('form')!.getAttribute('autocomplete'), 'off');
    assert.equal(doc.querySelector('input[type="password"]')!.getAttribute('type'), 'password');
    for (const field of doc.querySelectorAll('input')) {
      assert.equal(field.autocomplete, 'off'); assert.equal(field.getAttribute('data-lpignore'), 'true');
    }
    const modal = doc.createElement('div');
    modal.innerHTML = '<textarea></textarea><input type="search"><div contenteditable="true"></div>';
    doc.body.append(modal);
    await new Promise(done => setTimeout(done, 0));
    assert.equal(modal.querySelector('textarea')!.autocomplete, 'off');
    assert.equal(modal.querySelector('input')!.autocomplete, 'off');
    assert.equal(modal.querySelector('[contenteditable]')!.getAttribute('data-1p-ignore'), 'true');
    const input = modal.querySelector('input')!;
    input.autocomplete = 'username';
    input.dispatchEvent(new dom.window.FocusEvent('focusin', { bubbles: true }));
    assert.equal(input.autocomplete, 'off');
    cleanup();
    input.autocomplete = 'on';
    input.dispatchEvent(new dom.window.FocusEvent('focusin', { bubbles: true }));
    assert.equal(input.autocomplete, 'on');
  } finally { cleanup(); Object.assign(globalThis, previous); dom.window.close(); }
});
