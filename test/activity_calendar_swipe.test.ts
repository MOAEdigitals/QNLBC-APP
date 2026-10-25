import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as navigation from '../src/utils/swipeNavigation.ts';
import * as model from '../src/features/activities/model.ts';

test('calendar swipes change months while outside swipes still navigate; taps, scrolling, edges and cancelled gestures are protected', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.com/#special-numbers' });
  const keys = ['window', 'document', 'Element', 'HTMLElement', 'getComputedStyle', 'IS_REACT_ACT_ENVIRONMENT'];
  const previous = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  keys.forEach(key => Object.defineProperty(globalThis, key, { configurable: true, value: key === 'IS_REACT_ACT_ENVIRONMENT' ? true : (dom.window as any)[key] }));
  Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true });
  const load = (path: string, require: (name: string) => any) => {
    const exports: any = {};
    runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, {
      exports, require, window, document, Element: dom.window.Element, getComputedStyle: dom.window.getComputedStyle, performance, console,
    });
    return exports;
  };
  const hook = load('src/features/activities/useCalendarSwipe.ts', name => name === 'react' ? React : navigation);
  const swipe = load('src/components/SwipeNavigation.tsx', name => name === 'react' ? React : navigation);
  const activities = load('src/features/activities/Activities.tsx', name => {
    if (name === 'react') return React;
    if (name === './useCalendarSwipe') return hook;
    if (name === './model') return model;
    if (name === './data') return { fetchActivities: async () => [] };
    if (name === 'lucide-react') return new Proxy({}, { get: () => () => null });
    return new Proxy({}, { get: () => () => null });
  });
  const destinations: string[] = [];
  let subtab = '';
  function Screen() {
    const [section] = swipe.useSwipeSubtabs('special-numbers', 'activities'); subtab = section;
    return React.createElement('div', { className: 'qnlbc-app' }, React.createElement('div', { id: 'outside' }, 'Other screen content'), React.createElement(activities.default, { currentUser: null }));
  }
  const root = createRoot(document.getElementById('root')!);
  const touch = (type: string, target: Element, x: number, y = 300, multi = false) => {
    const event = new dom.window.Event(type, { bubbles: true, cancelable: true });
    const point = { identifier: 1, clientX: x, clientY: y };
    Object.assign(event, { touches: type === 'touchend' || type === 'touchcancel' ? [] : multi ? [point, { ...point, identifier: 2 }] : [point], changedTouches: [point] });
    target.dispatchEvent(event); return event;
  };
  const gesture = async (target: Element, from = 250, to = 100, endY = 300, cancel = false, multi = false) => {
    await act(async () => { touch('touchstart', target, from); touch('touchmove', target, to, endY, multi); touch(cancel ? 'touchcancel' : 'touchend', target, to, endY); });
  };
  const heading = () => document.querySelector('[aria-label="Activity calendar"] h2')!.textContent;
  const expected = (offset: number) => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth() + offset, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); };
  try {
    await act(async () => root.render(React.createElement(swipe.SwipeNavigationProvider, { currentTab: 'special-numbers', onNavigate: (tab: string) => destinations.push(tab) }, React.createElement(Screen))));
    const calendar = document.querySelector('[aria-label="Activity calendar"]')!;
    assert.equal(heading(), expected(0));
    const day = calendar.querySelector('.grid button')!;
    await gesture(day);
    assert.equal(heading(), expected(1)); assert.equal(subtab, 'activities'); assert.deepEqual(destinations, []);
    const click = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
    calendar.querySelector('.grid button')!.dispatchEvent(click);
    assert.equal(click.defaultPrevented, true, 'a swipe must not also select a date');
    await gesture(calendar, 100, 250);
    assert.equal(heading(), expected(0));
    for (const args of [[250, 270, 300, false, false], [250, 100, 520, false, false], [10, 200, 300, false, false], [250, 100, 300, true, false], [250, 100, 300, false, true]] as const) {
      await gesture(calendar, args[0], args[1], args[2], args[3], args[4]); assert.equal(heading(), expected(0)); assert.equal(subtab, 'activities');
    }
    // December -> January and January -> December use the same month calculation as arrow buttons.
    const monthsToJanuary = 12 - new Date().getMonth();
    for (let i = 0; i < monthsToJanuary; i++) await gesture(calendar);
    assert.equal(heading(), expected(monthsToJanuary));
    await gesture(calendar, 100, 250);
    assert.equal(heading(), expected(monthsToJanuary - 1));
    await new Promise(resolve => setTimeout(resolve, 360));
    await act(async () => (calendar.querySelector('[aria-label="Next month"]') as HTMLButtonElement).click());
    assert.equal(heading(), expected(monthsToJanuary), 'arrow controls still work');
    await gesture(document.getElementById('outside')!);
    assert.equal(subtab, 'schedules', 'outside swipes still change the active subtab');
    await gesture(document.getElementById('outside')!, 100, 250);
    await gesture(document.getElementById('outside')!, 100, 250);
    assert.deepEqual(destinations, ['recognitions'], 'outside swipes can still reach another main tab');
  } finally {
    await act(async () => root.unmount()); dom.window.close();
    keys.forEach((key, i) => { if (previous[i]) Object.defineProperty(globalThis, key, previous[i]!); else delete (globalThis as any)[key]; });
  }
});


