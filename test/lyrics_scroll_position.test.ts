import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

test('resizing long lyrics restores a scrolled form after temporary height collapse', () => {
  const effects: Array<() => void> = [];
  const react = { forwardRef: (fn: any) => fn, useRef: () => ({ current: null }), useLayoutEffect: (fn: () => void) => effects.push(fn), createElement: (_tag: any, props: any) => props };
  const exports: any = {};
  runInNewContext(ts.transpileModule(readFileSync('src/components/AutoGrowTextarea.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText, { exports, require: () => react });
  const form = { scrollHeight: 1800, clientHeight: 400, scrollTop: 950, parentElement: null };
  let height = '1600px';
  const textarea = { parentElement: form, scrollHeight: 1600, style: {
    get height() { return height; },
    set height(value) { height = value; if (value === 'auto') form.scrollTop = 0; },
  } };
  const props = exports.AutoGrowTextarea({ value: 'Long lyrics' }, null);
  props.ref(textarea);
  effects.forEach(effect => effect());
  assert.equal(form.scrollTop, 950);
  assert.equal(height, '1600px');
});
