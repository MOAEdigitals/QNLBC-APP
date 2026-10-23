import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as navigation from '../src/utils/swipeNavigation.ts';

test('swipe routes follow the visible main tabs and subtabs in both directions without wrapping', () => {
  const { swipeDestination: next } = navigation;
  assert.deepEqual(next('home', undefined, 1), { tab: 'recognitions', subtab: 'birthdays' });
  assert.deepEqual(next('recognitions', 'birthdays', 1), { tab: 'recognitions', subtab: 'special' });
  assert.deepEqual(next('recognitions', 'anniversaries', 1), { tab: 'special-numbers', subtab: 'activities' });
  assert.deepEqual(next('special-numbers', 'activities', -1), { tab: 'recognitions', subtab: 'anniversaries' });
  assert.deepEqual(next('songs', undefined, -1), { tab: 'special-numbers', subtab: 'practice' });
  assert.equal(next('home', undefined, -1), null); assert.equal(next('outlines', undefined, 1), null); assert.equal(next('settings', undefined, 1), null);
});

test('only intentional interior horizontal swipes navigate; edges, diagonals, taps and long presses do not', () => {
  const { swipeDirection: direction } = navigation;
  assert.equal(direction(250, 300, 100, 315, 390, 300), 1);
  assert.equal(direction(100, 300, 250, 315, 390, 300), -1);
  for (const [x, y, endX, endY, duration] of [[10, 300, 200, 300, 300], [380, 300, 200, 300, 300], [100, 300, 120, 300, 300], [250, 300, 100, 500, 300], [250, 300, 100, 300, 1200]]) assert.equal(direction(x, y, endX, endY, 390, duration), null);
});

test('real touch handling traverses subtabs and main tabs and protects editors, dialogs, drags and scrolls', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.com/#home' });
  const keys = ['window', 'document', 'Element', 'HTMLElement', 'getComputedStyle', 'IS_REACT_ACT_ENVIRONMENT'];
  const previous = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  keys.forEach(key => Object.defineProperty(globalThis, key, { configurable: true, value: key === 'IS_REACT_ACT_ENVIRONMENT' ? true : (dom.window as any)[key] }));
  Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true });
  const exports: any = {};
  runInNewContext(ts.transpileModule(readFileSync('src/components/SwipeNavigation.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, {
    exports, window, document, Element: dom.window.Element, getComputedStyle: dom.window.getComputedStyle, performance,
    require: (name: string) => name === 'react' ? React : navigation,
  });
  const { SwipeNavigationProvider, useSwipeSubtabs } = exports;
  let displayed = '', moves = 0;
  function Section({ tab }: { tab: string }) { const [subtab] = useSwipeSubtabs(tab, tab === 'recognitions' ? 'birthdays' : 'activities'); displayed = tab + '/' + subtab; return React.createElement('p', null, displayed); }
  function Fixture() {
    const [tab, setTab] = React.useState('home'); displayed = tab;
    return React.createElement(SwipeNavigationProvider, { currentTab: tab, onNavigate: (next: string) => { moves++; setTab(next); } }, React.createElement('div', { className: 'qnlbc-app' }, React.createElement('div', { id: 'surface' }, 'Swipe here'), React.createElement('input', { id: 'input' }), React.createElement('button', { id: 'drag', 'aria-label': 'Reorder song 1' }, 'drag'), (tab === 'recognitions' || tab === 'special-numbers') && React.createElement(Section, { key: tab, tab })));
  }
  const root = createRoot(document.getElementById('root')!);
  const touch = (type: string, target: Element, x: number, y = 300, multi = false) => { const event = new dom.window.Event(type, { bubbles: true, cancelable: true }); const finger = { identifier: 1, clientX: x, clientY: y }; Object.assign(event, { touches: type === 'touchend' ? [] : multi ? [finger, { ...finger, identifier: 2 }] : [finger], changedTouches: [finger] }); target.dispatchEvent(event); return event; };
  const swipe = async (id = 'surface', from = 250, to = 100, endY = 300) => act(async () => { const target = document.getElementById(id)!; touch('touchstart', target, from); touch('touchmove', target, to, endY); touch('touchend', target, to, endY); });
  try {
    await act(async () => root.render(React.createElement(Fixture)));
    await swipe(); assert.equal(displayed, 'recognitions/birthdays');
    await swipe(); assert.equal(displayed, 'recognitions/special');
    await swipe(); assert.equal(displayed, 'recognitions/anniversaries');
    await swipe(); assert.equal(displayed, 'special-numbers/activities');
    await swipe('surface', 100, 250); assert.equal(displayed, 'recognitions/anniversaries');
    const count = moves;
    await swipe('input'); await swipe('drag'); await swipe('surface', 10, 180); await swipe('surface', 250, 100, 500);
    assert.equal(displayed, 'recognitions/anniversaries'); assert.equal(moves, count);
    const modal = document.createElement('div'); modal.setAttribute('role', 'dialog'); document.body.append(modal);
    await swipe(); assert.equal(displayed, 'recognitions/anniversaries'); modal.remove();
    window.history.replaceState({ localScreen: 'reader' }, ''); await swipe(); assert.equal(displayed, 'recognitions/anniversaries');
    window.history.replaceState({}, '');
    await act(async () => { const target = document.getElementById('surface')!; touch('touchstart', target, 250); touch('touchmove', target, 200, 300, true); touch('touchend', target, 100); });
    assert.equal(displayed, 'recognitions/anniversaries');
    await swipe(); assert.equal(displayed, 'special-numbers/activities');
  } finally { await act(async () => root.unmount()); dom.window.close(); keys.forEach((key, i) => { if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else delete (globalThis as any)[key]; }); }
});
