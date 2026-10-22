import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

test('lyrics double-tap toggles once and ignores scrolls, long presses and controls', () => {
  const exports: any = {};
  runInNewContext(ts.transpileModule(readFileSync('src/hooks/useDoubleTap.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: () => ({ useRef: (value: any) => ({ current: value }) }) });
  let actions = 0;
  const handlers = exports.useDoubleTap(() => actions++);
  const event = (timeStamp: number, extra: any = {}) => ({ timeStamp, pointerType: 'touch', pointerId: 1, isPrimary: true, clientX: 100, clientY: 100, target: { closest: () => null }, preventDefault() {}, ...extra });
  const tap = (time: number) => { handlers.onPointerDown(event(time)); handlers.onPointerUp(event(time + 40)); };
  tap(0); assert.equal(actions, 0);
  tap(150); assert.equal(actions, 1);
  handlers.onDoubleClick(event(200)); assert.equal(actions, 1, 'synthetic dblclick must not toggle again');
  handlers.onPointerDown(event(1000)); handlers.onPointerMove(event(1010, { clientY: 150 })); handlers.onPointerUp(event(1020));
  tap(1100); assert.equal(actions, 1, 'scroll must not count as a tap');
  handlers.onPointerDown(event(1500)); handlers.onPointerUp(event(1900)); tap(1950); assert.equal(actions, 1, 'long press must not count');
  handlers.onPointerDown(event(2000, { target: { closest: () => ({}) } })); handlers.onPointerUp(event(2040)); assert.equal(actions, 1);
  tap(2500); tap(2700); assert.equal(actions, 2);
  handlers.onDoubleClick(event(3500, { pointerType: 'mouse' })); assert.equal(actions, 3, 'desktop double click remains supported');
});
