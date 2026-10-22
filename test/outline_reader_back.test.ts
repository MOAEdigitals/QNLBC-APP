import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as dates from '../src/utils/dateUtils.ts';
import { useBackLayer } from '../src/hooks/useBackLayer.ts';

// Exercise the actual reader with browser history, the same path used by Android Back.
test('outline Back returns to the list and keeps the app tab; reopening and toolbar Back also work', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.com/#outlines' });
  const keys = ['window', 'document', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT'];
  const saved = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  keys.forEach(key => Object.defineProperty(globalThis, key, { configurable: true, value: key === 'IS_REACT_ACT_ENVIRONMENT' ? true : (dom.window as any)[key] }));
  const row = { id: 'outline-one', title: 'Sunday preaching', service_date: '2026-10-25', preacher: 'Bro Ronnie', outline: 'Sermon text', attachments: [], status: 'published' };
  const dependencies: Record<string, any> = {
    '../../hooks/useBackLayer': { useBackLayer },
    '../../components/MonthSeparators': { monthList: (rows: any[]) => ({ render: (fn: any) => rows.map(fn) }) },
    '../../utils/upcomingCards': { upcomingCardStatuses: () => new Map() },
    '../../utils/dateUtils': { ...dates, getTodayStr: () => '2026-10-22' },
    './model': { listSermons: (rows: any[]) => rows },
    './data': { loadSermons: async () => [row] },
    './formatting': { renderOutline: () => 'Sermon text', sanitizeOutline: (html: string) => html },
  };
  const exports: any = {};
  runInNewContext(ts.transpileModule(readFileSync('src/features/sermons/SermonOutlines.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, {
    exports, window: dom.window, document: dom.window.document,
    require: (name: string) => name === 'react' ? React : dependencies[name] || new Proxy({}, { get: () => () => null }),
  });
  const root = createRoot(document.getElementById('root')!);
  let tabNavigations = 0;
  const appBack = () => tabNavigations++;
  window.history.replaceState({ tab: 'outlines' }, '');
  window.addEventListener('popstate', appBack);
  const wait = () => new Promise(resolve => setTimeout(resolve, 50));
  const open = async () => act(async () => { document.querySelector<HTMLButtonElement>('.app-date-card > button')!.click(); });
  try {
    await act(async () => root.render(React.createElement(exports.default, { currentUser: null })));
    await open(); assert.ok(document.querySelector('[role="dialog"]'));
    await act(async () => { window.history.back(); await wait(); });
    assert.equal(document.querySelector('[role="dialog"]'), null);
    assert.ok(document.querySelector('.app-date-card'));
    assert.equal(tabNavigations, 0);
    assert.equal(window.location.hash, '#outlines');
    await open();
    await act(async () => { document.querySelector<HTMLButtonElement>('[aria-label="Back to sermons"]')!.click(); await wait(); });
    assert.equal(document.querySelector('[role="dialog"]'), null);
    assert.equal(tabNavigations, 0);
    await open();
    await act(async () => { window.history.back(); await wait(); });
    assert.equal(document.querySelector('[role="dialog"]'), null);
    assert.equal(tabNavigations, 0);
  } finally {
    await act(async () => root.unmount()); window.removeEventListener('popstate', appBack); dom.window.close();
    keys.forEach((key, i) => { if (saved[i]) Object.defineProperty(globalThis, key, saved[i]!); else delete (globalThis as any)[key]; });
  }
});
