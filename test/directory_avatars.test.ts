import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import ts from 'typescript';

test('directory-linked pictures refresh on profile changes and fall back to the person icon when absent', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.com' });
  const keys = ['window', 'document', 'navigator', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT'];
  const old = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  keys.forEach(key => Object.defineProperty(globalThis, key, { configurable: true, value: key === 'IS_REACT_ACT_ENVIRONMENT' ? true : (dom.window as any)[key] }));
  const require = createRequire(import.meta.url), React = require('react'), { act } = React;
  const root = require('react-dom/client').createRoot(document.getElementById('root'));
  let rows: any[] = [{ name: ' BRO ROGER ', avatar_url: 'https://example.com/one.jpg' }], changed: (() => void) | undefined;
  const channel = { on(_: string, filter: any, callback: () => void) { if (filter.table === 'profiles') changed = callback; return channel; }, subscribe() { return channel; } };
  const db = { rpc: async () => ({ data: rows }), channel: () => channel, removeChannel() {} };
  const compile = (path: string, mocks: any) => {
    const exports: any = {};
    runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, { exports, window, document, clearInterval, require: (name: string) => mocks[name] || require(name) });
    return exports;
  };
  const hook = compile('src/hooks/useDirectoryAvatars.ts', { '../supabase': { supabase: db } });
  const { PersonAvatar } = compile('src/components/PersonAvatar.tsx', {});
  function Harness() { const pictures = hook.useDirectoryAvatars('user'); return React.createElement(PersonAvatar, { name: 'Bro Roger', src: pictures['bro roger'] }); }
  try {
    await act(async () => root.render(React.createElement(Harness)));
    assert.equal(document.querySelector('img')?.getAttribute('src'), 'https://example.com/one.jpg');
    rows = [{ name: 'BRO ROGER', avatar_url: 'https://example.com/two.jpg' }];
    await act(async () => changed!());
    assert.equal(document.querySelector('img')?.getAttribute('src'), 'https://example.com/two.jpg');
    await act(() => document.querySelector('img')!.dispatchEvent(new dom.window.Event('error')));
    assert.equal(document.querySelector('img'), null); assert.ok(document.querySelector('svg'));
    rows = []; await act(async () => changed!());
    assert.equal(document.querySelector('img'), null);
  } finally {
    await act(() => root.unmount()); dom.window.close();
    keys.forEach((key, i) => { if (old[i]) Object.defineProperty(globalThis, key, old[i]!); else delete (globalThis as any)[key]; });
  }
});
