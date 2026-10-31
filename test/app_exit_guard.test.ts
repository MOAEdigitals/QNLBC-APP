import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import React, { act } from 'react';
import * as ReactDOM from 'react-dom';
import { JSDOM } from 'jsdom';
import ts from 'typescript';
import { useBackLayer } from '../src/hooks/useBackLayer.ts';

const wait = () => new Promise(resolve => setTimeout(resolve, 45));
async function fixture(tab: string, native: boolean, run: (get: () => any, back: (canGoBack: boolean) => void, dom: JSDOM, exits: () => number) => Promise<void>) {
  const dom = new JSDOM('<div id="root"></div>', { url: `https://example.test/#${tab}` });
  const keys = ['window','document','HTMLElement','IS_REACT_ACT_ENVIRONMENT'];
  const old = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  keys.forEach(key => Object.defineProperty(globalThis, key, { configurable: true, value: key === 'IS_REACT_ACT_ENVIRONMENT' ? true : (dom.window as any)[key] }));
  let nativeBack: ((event: { canGoBack: boolean }) => void) | undefined; let exitCalls = 0;
  const exports: any = {};
  runInNewContext(ts.transpileModule(readFileSync('src/hooks/useAppExitGuard.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, window: dom.window, document: dom.window.document, KeyboardEvent: dom.window.KeyboardEvent,
    require: (name: string) => name === 'react' ? React : name === '@capacitor/core' ? { Capacitor: { isNativePlatform: () => native } } : { App: { addListener: async (_: string, listener: typeof nativeBack) => { nativeBack = listener; return { remove() {} }; }, exitApp: async () => { exitCalls++; } } },
  });
  runInNewContext(ts.transpileModule(readFileSync('src/components/ExitConfirmation.tsx','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText, {
    exports, document: dom.window.document,
    require: (name: string) => name === 'react' ? React : name === 'react-dom' ? ReactDOM : new Proxy({}, { get: () => () => null }),
  });
  let ui: any;
  function Fixture() {
    const [current, setTab] = React.useState(tab), [layer, setLayer] = React.useState(false);
    const guard = exports.useAppExitGuard(current);
    useBackLayer(layer, () => setLayer(false));
    ui = { ...guard, setTab, setLayer, layer };
    return React.createElement(exports.ExitConfirmation, { open: guard.isOpen, busy: guard.exiting, onCancel: guard.cancel, onExit: () => void guard.confirmExit() });
  }
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(document.getElementById('root')!);
  try {
    await act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(Fixture))));
    await run(() => ui, canGoBack => nativeBack!({ canGoBack }), dom, () => exitCalls);
  } finally { await act(async () => root.unmount()); await wait(); dom.window.close(); keys.forEach((key, i) => { if (old[i]) Object.defineProperty(globalThis, key, old[i]!); else delete (globalThis as any)[key]; }); }
}

for (const tab of ['home','recognitions','special-numbers','songs','outlines','settings']) test(`Back at the ${tab} boundary asks before exit and Cancel re-arms the guard`, async () => {
  await fixture(tab, false, async (get, _, dom) => {
    await act(async () => { dom.window.history.back(); await wait(); });
    assert.equal(get().isOpen, true); assert.equal(dom.window.history.state.tab, tab);
    assert.equal(document.querySelector('[role="alertdialog"] h3')!.textContent, 'Exit app?');
    assert.equal(document.activeElement?.textContent, 'Cancel', 'default keyboard action must be safe');
    await act(() => get().cancel()); assert.equal(get().isOpen, false);
    await act(async () => { dom.window.history.back(); await wait(); }); assert.equal(get().isOpen, true);
    await act(async () => { dom.window.history.back(); await wait(); }); assert.equal(get().isOpen, false, 'Back on confirmation means Cancel');
    assert.equal(dom.window.history.state.tab, tab);
  });
});

test('Android has a safe no-history fallback, prevents rapid Back bypass, and exits only after explicit confirmation', async () => {
  await fixture('songs', true, async (get, back, _, exits) => {
    await act(async () => get().confirmExit()); assert.equal(exits(), 0);
    await act(() => back(false)); assert.equal(get().isOpen, true); assert.equal(exits(), 0);
    await act(() => back(false)); assert.equal(get().isOpen, false, 'second Back cancels');
    await act(async () => { back(true); back(true); await wait(); });
    assert.equal(get().isOpen, true); assert.equal(exits(), 0, 'rapid Back never confirms exit');
    await act(async () => { await get().confirmExit(); await get().confirmExit(); });
    assert.equal(exits(), 1);
  });
});

test('Back closes a local screen first and Android dismisses the keyboard and action menus before asking to exit', async () => {
  await fixture('settings', true, async (get, back, dom) => {
    await act(() => get().setLayer(true));
    await act(async () => { back(true); await wait(); });
    assert.equal(get().layer, false); assert.equal(get().isOpen, false);
    const input = dom.window.document.createElement('input'); document.body.append(input); input.focus(); document.documentElement.classList.add('keyboard-open');
    await act(() => back(false)); assert.notEqual(document.activeElement, input); assert.equal(get().isOpen, false);
    document.documentElement.classList.remove('keyboard-open');
    const menu = document.createElement('div'); menu.dataset.setlistActions = 'one'; menu.innerHTML = '<button aria-expanded="true">Actions</button>'; document.body.append(menu);
    menu.addEventListener('keydown', () => menu.querySelector('button')!.setAttribute('aria-expanded','false'));
    await act(() => back(false)); assert.equal(get().isOpen, false); assert.equal(menu.querySelector('button')!.getAttribute('aria-expanded'),'false');
    await act(() => back(false)); assert.equal(get().isOpen, true);
  });
});

test('exit confirmation is rendered during loading, signed out and signed in; no automatic exit or logout path remains', () => {
  const source = readFileSync('src/App.tsx','utf8');
  assert.equal((source.match(/<ExitConfirmation /g) || []).length, 3);
  assert.ok(source.indexOf('useAppExitGuard(currentTab)') < source.indexOf('if (isLoadingInitialData)'));
  assert.doesNotMatch(source, /NativeApp\.exitApp\(|setShowLogoutConfirmModal|history\.go\(-2\)/);
});

test('Exit dialog cancels with Escape and buttons; only the explicit Exit button closes Android', async () => {
  await fixture('home', true, async (get, back, dom, exits) => {
    await act(() => back(false));
    await act(() => document.activeElement!.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.equal(get().isOpen, false); assert.equal(exits(), 0);
    await act(() => back(false));
    await act(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Cancel')!.click());
    assert.equal(get().isOpen, false); assert.equal(exits(), 0);
    await act(() => back(false));
    await act(async () => Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Exit app')!.click());
    assert.equal(exits(), 1);
  });
});
