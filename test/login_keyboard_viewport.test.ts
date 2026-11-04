import assert from 'node:assert/strict';
import { installFormViewport } from '../src/utils/formViewport.ts';
import { test } from 'node:test';

test('overlay keyboard sizes the login viewport above the IME and resets on dismissal', () => {
  let frame: (() => void) | null = null;
  const flush = () => { const run = frame; frame = null; run?.(); };
  const events = new Map<string, () => void>();
  const css = new Map<string, string>(); let open = false;
  const keyboard = { overlaysContent: false, boundingRect: { height: 0, y: 850 }, addEventListener: (event: string, callback: () => void) => events.set(event, callback) };
  const viewport = { height: 850, offsetTop: 0, addEventListener() {} };
  const win = { innerHeight: 850, innerWidth: 393, visualViewport: viewport, addEventListener() {}, requestAnimationFrame: (cb: () => void) => { frame = cb; return 1; }, cancelAnimationFrame() {} };
  installFormViewport(win as any, { documentElement: { classList: { toggle: (_: string, value: boolean) => { open = value; } }, style: { setProperty: (key: string, value: string) => css.set(key, value) } } } as any, { virtualKeyboard: keyboard } as any);
  keyboard.boundingRect = { height: 450, y: 400 }; events.get('geometrychange')!(); flush();
  assert.equal(open, true); assert.equal(css.get('--form-viewport-height'), '400px');
  viewport.offsetTop = 60; events.get('geometrychange')!(); flush();
  assert.equal(css.get('--form-viewport-height'), '340px');
  assert.equal(css.get('--form-viewport-top'), '60px');
  viewport.offsetTop = 0;
  keyboard.boundingRect = { height: 0, y: 850 }; events.get('geometrychange')!(); flush();
  assert.equal(open, false); assert.equal(css.get('--form-viewport-height'), '850px');
});
