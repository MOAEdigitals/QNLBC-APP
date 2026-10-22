import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { JSDOM } from 'jsdom';
import ts from 'typescript';

test('editor sections toggle independently, keep fields mounted and reveal invalid hidden fields', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  const keys = ['window', 'document', 'navigator', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT'];
  const saved = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  keys.forEach(key => Object.defineProperty(globalThis, key, { configurable: true, value: key === 'IS_REACT_ACT_ENVIRONMENT' ? true : (dom.window as any)[key] }));
  const require = createRequire(import.meta.url), React = require('react');
  const { act } = React, root = require('react-dom/client').createRoot(document.getElementById('root'));
  const exports: any = {}, frames: Array<() => void> = [];
  runInNewContext(ts.transpileModule(readFileSync('src/components/SetlistEditorSection.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText, {
    exports, requestAnimationFrame: (callback: () => void) => frames.push(callback), require: (name: string) => name === 'react' ? React : new Proxy({}, { get: () => () => null }),
  });
  try {
    await act(() => root.render(React.createElement('form', null,
      React.createElement(exports.SetlistEditorSection, { title: 'Service Details', colorClass: 'text-sky-700', initialOpen: true }, React.createElement('input', { id: 'date', required: true, defaultValue: '2026-10-25' })),
      React.createElement(exports.SetlistEditorSection, { title: 'Sunday School', colorClass: 'text-amber-700' }, React.createElement('input', { id: 'song', defaultValue: 'Amazing Grace' })),
      React.createElement(exports.SetlistEditorSection, { title: 'Worship Service', colorClass: 'text-indigo-700' }, React.createElement('input', { id: 'leader', defaultValue: 'Bro Joshua' })),
    )));
    const buttons = [...document.querySelectorAll('button')];
    assert.deepEqual(buttons.map(button => button.textContent), ['Service Details', 'Sunday School', 'Worship Service']);
    assert.deepEqual(buttons.map(button => button.getAttribute('aria-expanded')), ['true', 'false', 'false']);
    const song = document.getElementById('song') as HTMLInputElement;
    await act(() => buttons[1].click());
    song.value = 'Blessed Assurance';
    await act(() => buttons[1].click());
    await act(() => buttons[2].click());
    assert.equal(song.closest('[hidden]') !== null, true);
    assert.equal(document.getElementById('song'), song, 'collapse preserves the mounted field');
    assert.equal(song.value, 'Blessed Assurance');
    assert.equal(buttons[0].getAttribute('aria-expanded'), 'true', 'opening another section does not close this one');
    await act(() => buttons[0].click());
    const date = document.getElementById('date') as HTMLInputElement;
    date.value = '';
    await act(() => date.dispatchEvent(new dom.window.Event('invalid', { cancelable: true })));
    assert.equal(buttons[0].getAttribute('aria-expanded'), 'true', 'a hidden required field opens its section');
    await act(() => frames.splice(0).forEach(callback => callback()));
    assert.equal(document.activeElement, date);
  } finally {
    await act(() => root.unmount()); dom.window.close();
    keys.forEach((key, index) => { if (saved[index]) Object.defineProperty(globalThis, key, saved[index]!); else delete (globalThis as any)[key]; });
  }
});
