import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

test('overlay keyboard sizes the login viewport above the IME and resets on dismissal', () => {
  const source = readFileSync('src/main.tsx', 'utf8');
  const code = source.slice(source.indexOf('const keyboard ='), source.indexOf('createRoot(document'));
  const events = new Map<string, () => void>();
  const css = new Map<string, string>(); let open = false;
  const keyboard = { overlaysContent: false, boundingRect: { height: 0, y: 850 }, addEventListener: (event: string, callback: () => void) => events.set(event, callback) };
  const viewport = { height: 850, offsetTop: 0, addEventListener() {} };
  const win = { innerHeight: 850, innerWidth: 393, visualViewport: viewport, addEventListener() {} };
  runInNewContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, {
    navigator: { virtualKeyboard: keyboard }, window: win,
    document: { documentElement: { classList: { toggle: (_: string, value: boolean) => { open = value; } }, style: { setProperty: (key: string, value: string) => css.set(key, value) } } },
  });
  keyboard.boundingRect = { height: 450, y: 400 }; events.get('geometrychange')!();
  assert.equal(open, true); assert.equal(css.get('--form-viewport-height'), '400px');
  viewport.offsetTop = 60; events.get('geometrychange')!();
  assert.equal(css.get('--form-viewport-height'), '340px');
  assert.equal(css.get('--form-viewport-top'), '60px');
  viewport.offsetTop = 0;
  keyboard.boundingRect = { height: 0, y: 850 }; events.get('geometrychange')!();
  assert.equal(open, false); assert.equal(css.get('--form-viewport-height'), '850px');
});
