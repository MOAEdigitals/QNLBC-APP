import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { useSearchResultsScroll } from '../src/hooks/useSearchResultsScroll.ts';

test('search opens at the top and resets on typed, deferred and cleared queries without hijacking normal scrolling', async () => {
  const dom = new JSDOM('<div id="root"></div>');
  const keys = ['window', 'document', 'IS_REACT_ACT_ENVIRONMENT'];
  const saved = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  keys.forEach(key => Object.defineProperty(globalThis, key, { configurable: true, value: key === 'IS_REACT_ACT_ENVIRONMENT' ? true : (dom.window as any)[key] }));
  let scrollY = 1800, calls = 0, open: () => void = () => {};
  dom.window.scrollTo = ((options: ScrollToOptions) => {
    assert.equal(options.behavior, 'instant', 'typing must not queue smooth scroll animations');
    scrollY = options.top!; calls++;
  }) as any;
  function Results({ query, rendered }: { query: string; rendered: string }) {
    open = useSearchResultsScroll(query, rendered);
    return React.createElement('main', null, rendered || 'All results');
  }
  const root = createRoot(document.getElementById('root')!);
  const render = (query: string, rendered = query) => act(() => root.render(React.createElement(Results, { query, rendered })));
  try {
    await render('');
    assert.equal(scrollY, 1800, 'mounting preserves restored tab/card scroll');
    open(); assert.equal(scrollY, 0, 'opening search reveals the first results');
    scrollY = 2200;
    await render('grace', ''); assert.equal(scrollY, 0);
    scrollY = 120;
    await render('grace', 'grace'); assert.equal(scrollY, 0, 'deferred results also start at the top');
    scrollY = 500; const before = calls;
    await render('grace'); assert.equal(scrollY, 500); assert.equal(calls, before, 'unchanged-query/background rerenders allow browsing matches');
    await render(''); assert.equal(scrollY, 0, 'clearing search reveals the start of the full list');
  } finally {
    await act(() => root.unmount()); dom.window.close();
    keys.forEach((key, i) => { if (saved[i]) Object.defineProperty(globalThis, key, saved[i]!); else delete (globalThis as any)[key]; });
  }
});
