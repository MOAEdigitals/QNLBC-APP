import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { JSDOM } from 'jsdom';
import ts from 'typescript';
import * as model from '../src/features/activities/model.ts';
import * as monthOrder from '../src/utils/recognitionOrder.ts';

test('Schedules filter controls hide matching cards and calendar dots, including Midweek titles', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  const keys = ['window', 'document', 'navigator', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT'];
  const saved = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  keys.forEach(key => Object.defineProperty(globalThis, key, { configurable: true, value: key === 'IS_REACT_ACT_ENVIRONMENT' ? true : (dom.window as any)[key] }));
  const require = createRequire(import.meta.url), React = require('react');
  const { act } = React, root = require('react-dom/client').createRoot(document.getElementById('root'));
  const now = new Date();
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const items = ['Midweek Prayer Meeting', 'Sunday Service', 'Song Leaders & Choir Practice', 'Church Anniversary'].map((title, index) => ({ id: String(index), title, activityDate: day }));
  let updateHeader: (node: any) => void;
  let searchConfig: any;
  const scrollTargets: HTMLElement[] = [];
  const exports: any = {};
  runInNewContext(ts.transpileModule(readFileSync('src/features/activities/Activities.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText, {
    exports, document, window: dom.window, console,
    require: (name: string) => name === 'react' ? React : name === './highlight' ? { scrollActivityBelowHeader: (target: HTMLElement) => scrollTargets.push(target) } : name === './model' ? model : name.includes('recognitionOrder') ? monthOrder : name === './data' ? { fetchActivities: async () => items } : name.includes('HeaderSearch') ? { useHeaderSearch: (config: any) => { searchConfig = config; React.useEffect(() => updateHeader(config.beforeSearch), [config.beforeSearch]); } } : name.includes('MonthSeparators') ? { groupByMonth: (entries: any[]) => [{ key: day.slice(0, 7), label: 'This month', items: entries }] } : new Proxy({}, { get: () => () => null }),
  });
  function Harness() {
    const [header, setHeader] = React.useState(null); updateHeader = setHeader;
    return React.createElement(React.Fragment, null, header, React.createElement(exports.default, { currentUser: null }));
  }
  try {
    await act(async () => { root.render(React.createElement(Harness)); });
    const cards = () => [...document.querySelectorAll('article[id^="activity-card-"]')].map(element => element.querySelector('h3')!.textContent);
    assert.equal(cards().length, 3);
    assert.ok(!cards().includes('Song Leaders & Choir Practice'));
    await act(() => (document.querySelector('[aria-label="Filter activities"]') as HTMLButtonElement).click());
    assert.equal(document.querySelector('[aria-label="Filter activities"]')!.getAttribute('aria-expanded'), 'true');
    const checkbox = (label: string) => [...document.querySelectorAll('label')].find(element => element.textContent === label)!.querySelector('input')!;
    assert.equal(checkbox('Prayer meetings').checked, true);
    assert.equal(checkbox('Sunday service').checked, true);
    assert.equal(checkbox('Other events').checked, true);
    assert.equal(checkbox('Choir & song leader practice').checked, false);
    await act(() => checkbox('Choir & song leader practice').click());
    assert.equal(cards().length, 4, 'practice can still be enabled manually');
    await act(() => checkbox('Prayer meetings').click());
    assert.ok(!cards().includes('Midweek Prayer Meeting'));
    assert.ok(document.querySelector(`[aria-label="${day}, 3 activities"]`));
    await act(() => checkbox('Choir & song leader practice').click());
    assert.ok(!cards().includes('Song Leaders & Choir Practice'));
    await act(() => checkbox('Other events').click());
    assert.deepEqual(cards(), ['Sunday Service']);
    await act(() => checkbox('Sunday service').click());
    assert.equal(cards().length, 0);
    assert.ok(document.querySelector(`[aria-label="${day}"]`), 'calendar has no dots for filtered-out cards');
    await act(() => checkbox('Prayer meetings').click());
    assert.deepEqual(cards(), ['Midweek Prayer Meeting']);
    assert.equal(scrollTargets.length, 0, 'ordinary calendar/filter use does not scroll to search results');
    await act(() => searchConfig.onOpen());
    assert.equal(scrollTargets.at(-1), document.querySelector('[data-activity-results]'));
    await act(() => searchConfig.onChange('No such activity'));
    assert.equal(cards().length, 0);
    assert.equal(scrollTargets.length, 2, 'typing aligns the filtered or empty results instead of the calendar');
    assert.equal(scrollTargets.at(-1), document.querySelector('[data-activity-results]'));
  } finally {
    await act(() => root.unmount()); dom.window.close();
    keys.forEach((key, index) => { if (saved[index]) Object.defineProperty(globalThis, key, saved[index]!); else delete (globalThis as any)[key]; });
  }
});
