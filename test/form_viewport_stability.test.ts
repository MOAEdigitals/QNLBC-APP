import test from 'node:test';
import assert from 'node:assert/strict';
import { installFormViewport } from '../src/utils/formViewport.ts';

test('focus pans and fractional viewport noise do not move forms; resize events share one frame', () => {
  const events = new Map<string, () => void>(), values = new Map<string, string>();
  let frame: (() => void) | null = null, writes = 0, cancelled = false;
  const viewport = { height: 850, offsetTop: 0, scale: 1, addEventListener: (name: string, fn: () => void) => events.set(name, fn), removeEventListener: (name: string) => events.delete(name) };
  const win = { innerHeight: 850, innerWidth: 393, visualViewport: viewport, addEventListener() {}, removeEventListener() {}, requestAnimationFrame: (fn: () => void) => { frame = fn; return 1; }, cancelAnimationFrame() { cancelled = true; } };
  const stop = installFormViewport(win as any, { documentElement: { classList: { toggle() {} }, style: { setProperty: (key: string, value: string) => { values.set(key, value); writes++; } } } } as any, {} as any);
  const flush = () => { const run = frame; frame = null; run?.(); };
  assert.equal(writes, 2);
  viewport.offsetTop = .6; viewport.height = 849.7; events.get('scroll')!(); events.get('resize')!();
  assert.equal(writes, 2, 'no synchronous layout writes during focus/resize events');
  flush(); assert.equal(writes, 2, 'subpixel noise is ignored');
  viewport.offsetTop = 22; viewport.height = 850; events.get('scroll')!(); flush();
  assert.equal(values.get('--form-viewport-top'), '0px', 'pre-keyboard focus panning cannot shift the whole form');
  assert.equal(values.get('--form-viewport-height'), '850px');
  viewport.height = 500; viewport.offsetTop = 24.6; events.get('resize')!(); flush();
  assert.equal(values.get('--form-viewport-height'), '500px'); assert.equal(values.get('--form-viewport-top'), '25px');
  const keyboardWrites = writes;
  viewport.offsetTop = 24.8; viewport.height = 500.4; events.get('scroll')!(); flush();
  assert.equal(writes, keyboardWrites, 'keyboard geometry is stable to fractional changes');
  events.get('resize')!(); stop(); assert.equal(cancelled, true); assert.equal(events.size, 0);
});
