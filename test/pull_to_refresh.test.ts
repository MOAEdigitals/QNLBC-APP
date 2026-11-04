import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { installPullToRefresh } from '../src/utils/pullToRefresh.ts';

test('top pulls refresh empty/short lists once, retain the page and settle after completion', async () => {
  const dom = new JSDOM('<div class="qnlbc-app"><main>Empty list</main></div>');
  const win = dom.window, doc = win.document;
  let calls = 0, blocked = false, enabled = true, finish: () => void = () => {};
  const states: Array<[number, boolean]> = [];
  const stop = installPullToRefresh({ enabled: () => enabled, blocked: () => blocked, refresh: () => { calls++; return new Promise<void>(resolve => { finish = resolve; }); }, progress: (distance, busy) => states.push([distance, busy]) }, win as any, doc);
  const touch = (type: string, x = 80, y = 80, target = doc.querySelector('main')!, count = 1) => {
    const event = new win.Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'touches', { value: Array.from({ length: count }, (_, identifier) => ({ identifier, clientX: x, clientY: y })) });
    target.dispatchEvent(event); return event;
  };
  const pull = (x = 80, y = 230) => { touch('touchstart'); const move = touch('touchmove', x, y); touch('touchend', x, y); return move; };
  const settle = () => new Promise(resolve => setTimeout(resolve, 0));
  try {
    assert.equal(pull().defaultPrevented, true, 'app owns the pull instead of a full-page reload');
    await settle(); assert.equal(calls, 1); assert.deepEqual(states.at(-1), [64, true]);
    pull(); await settle(); assert.equal(calls, 1, 'repeated pulls cannot stack requests');
    finish(); await settle(); assert.deepEqual(states.at(-1), [0, false]);
    assert.ok(doc.querySelector('main'), 'the current screen stays mounted');
    for (const [x, y] of [[80, 120], [250, 100], [80, 20]]) { pull(x, y); await settle(); }
    assert.equal(calls, 1, 'short, horizontal and upward gestures never refresh');
    touch('touchstart'); touch('touchmove', 80, 230); touch('touchcancel'); touch('touchend');
    await settle(); assert.equal(calls, 1, 'cancelled pulls never refresh');
    Object.defineProperty(win, 'scrollY', { configurable: true, value: 200 });
    touch('touchstart'); Object.defineProperty(win, 'scrollY', { configurable: true, value: 0 });
    touch('touchmove', 80, 230); touch('touchend'); await settle(); assert.equal(calls, 1, 'scrolling to the top requires a fresh pull');
    for (const html of ['<div class="ui-form-screen"></div>', '<div class="ui-viewport-screen"></div>', '<div class="ui-picker-viewport"></div>', '<div role="menu"></div>', '<div role="dialog"></div>']) {
      const layer = doc.createElement('div'); layer.innerHTML = html; doc.body.append(layer);
      assert.equal(pull().defaultPrevented, false); await settle(); assert.equal(calls, 1, html); layer.remove();
    }
    blocked = true; pull(); blocked = false; enabled = false; pull(); enabled = true;
    doc.documentElement.classList.add('keyboard-open'); pull(); doc.documentElement.classList.remove('keyboard-open');
    touch('touchstart'); blocked = true; touch('touchmove', 80, 230); blocked = false; touch('touchend');
    touch('touchstart'); touch('touchmove', 80, 230, undefined, 2); touch('touchend');
    await settle(); assert.equal(calls, 1, 'forms appearing mid-pull, keyboard, disabled states and multitouch are protected');
    stop(); pull(); await settle(); assert.equal(calls, 1, 'cleanup removes all gesture listeners');
  } finally { stop(); dom.window.close(); }
});

test('a failed refresh settles and allows a later retry', async () => {
  const dom = new JSDOM('<div class="qnlbc-app"><main><button>Open outline</button></main></div>');
  let count = 0, busy = false;
  const stop = installPullToRefresh({ enabled: () => true, blocked: () => false, refresh: async () => { count++; throw new Error('Offline'); }, progress: (_, refreshing) => { busy = refreshing; } }, dom.window as any, dom.window.document);
  const pull = () => {
    for (const [type, y] of [['touchstart', 80], ['touchmove', 240], ['touchend', 240]] as const) {
      const event = new dom.window.Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'touches', { value: [{ identifier: 1, clientX: 80, clientY: y }] });
      dom.window.document.querySelector('button')!.dispatchEvent(event);
    }
  };
  try {
    pull(); await new Promise(resolve => setTimeout(resolve, 0)); assert.equal(busy, false); assert.equal(count, 1);
    pull(); await new Promise(resolve => setTimeout(resolve, 0)); assert.equal(count, 2);
  } finally { stop(); dom.window.close(); }
});
