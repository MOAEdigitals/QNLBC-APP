import test from 'node:test';
import assert from 'node:assert/strict';
import { installFormViewport } from '../src/utils/formViewport.ts';
import { isRoutineActivity } from '../src/features/activities/model.ts';

test('form actions leave the keyboard area on both viewport and WebView resize', () => {
  let frame: (() => void) | null = null;
  const flush = () => { const run = frame; frame = null; run?.(); };
  const listeners: Record<string, () => void> = {};
  let open = false;
  const viewport = { height: 800, offsetTop: 0, addEventListener: (event: string, cb: () => void) => { listeners[event] = cb; } };
  const window = { innerHeight: 800, innerWidth: 390, visualViewport: viewport, addEventListener() {}, requestAnimationFrame: (cb: () => void) => { frame = cb; return 1; }, cancelAnimationFrame() {} };
  const document = { documentElement: { classList: { toggle: (_: string, value: boolean) => { open = value; } }, style: { setProperty() {} } } };
  installFormViewport(window as any, document as any, {} as any);
  assert.equal(open, false);
  viewport.height = 500; listeners.resize(); flush(); assert.equal(open, true);
  viewport.height = 800; listeners.resize(); flush(); assert.equal(open, false);
  window.innerHeight = 500; viewport.height = 500; listeners.resize(); flush(); assert.equal(open, true);
  window.innerHeight = 800; viewport.height = 800; listeners.resize(); flush(); assert.equal(open, false);
});

test('routine gatherings stay neutral while special events receive a subtle accent', () => {
  for (const title of ['Midweek Prayer Meeting', 'Song Leaders & Choir Practice', 'Sunday Service', 'Saturday practice']) assert.equal(isRoutineActivity(title), true, title);
  for (const title of ['Church anniversary', 'Youth fellowship', 'Thanksgiving celebration']) assert.equal(isRoutineActivity(title), false, title);
});
