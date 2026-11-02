import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import React, { act } from 'react';
import * as ReactDOM from 'react-dom';
import { JSDOM } from 'jsdom';
import ts from 'typescript';
import * as backLayers from '../src/hooks/useBackLayer.ts';
const { useBackLayer } = backLayers;

const wait = () => new Promise(resolve => setTimeout(resolve, 45));
async function fixture(tab: string, native: boolean, run: (get: () => any, back: (canGoBack: boolean) => void, dom: JSDOM, exits: () => number) => Promise<void>) {
  const dom = new JSDOM('<div id="root"></div>', { url: `https://example.test/#${tab}` });
  const keys = ['window','document','HTMLElement','IS_REACT_ACT_ENVIRONMENT'];
  const old = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  keys.forEach(key => Object.defineProperty(globalThis, key, { configurable: true, value: key === 'IS_REACT_ACT_ENVIRONMENT' ? true : (dom.window as any)[key] }));
  let nativeBack: ((event: { canGoBack: boolean }) => void) | undefined; let exitCalls = 0, nativeListeners = 0;
  const exports: any = {};
  runInNewContext(ts.transpileModule(readFileSync('src/hooks/useAppExitGuard.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, window: dom.window, document: dom.window.document, KeyboardEvent: dom.window.KeyboardEvent, setTimeout, clearTimeout,
    require: (name: string) => name.endsWith('useBackLayer') ? backLayers : name === 'react' ? React : name === '@capacitor/core' ? { Capacitor: { isNativePlatform: () => native } } : { App: { addListener: async (_: string, listener: typeof nativeBack) => { nativeBack = listener; nativeListeners++; return { remove() { nativeListeners--; } }; }, exitApp: async () => { exitCalls++; } } },
  });
  runInNewContext(ts.transpileModule(readFileSync('src/components/ExitConfirmation.tsx','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText, {
    exports, document: dom.window.document,
    require: (name: string) => name === 'react' ? React : name === 'react-dom' ? ReactDOM : new Proxy({}, { get: () => () => null }),
  });
  let ui: any;
  function Fixture() {
    const [current, setTab] = React.useState(tab), [layer, setLayer] = React.useState(false);
    const guard = exports.useAppExitGuard(current, () => setTab('special-numbers'));
    useBackLayer(layer, () => setLayer(false));
    ui = { ...guard, current, setTab, setLayer, layer };
    return React.createElement(exports.ExitConfirmation, { open: guard.isOpen, busy: guard.exiting, message: guard.exitMessage, onCancel: guard.cancel, onExit: () => void guard.confirmExit() });
  }
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(document.getElementById('root')!);
  try {
    await act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(Fixture))));
    await run(() => ui, canGoBack => nativeBack!({ canGoBack }), dom, () => exitCalls);
  } finally { await act(async () => root.unmount()); await wait(); assert.equal(nativeListeners, 0, 'native listeners must be removed on unmount'); dom.window.close(); keys.forEach((key, i) => { if (old[i]) Object.defineProperty(globalThis, key, old[i]!); else delete (globalThis as any)[key]; }); }
}

for (const tab of ['home', 'recognitions', 'songs', 'outlines', 'settings']) test(`Back from ${tab} goes to Schedules first, then asks at the root`, async () => {
  await fixture(tab, false, async (get, _, dom) => {
    await act(async () => { dom.window.history.back(); await wait(); });
    assert.equal(get().current, 'special-numbers'); assert.equal(get().isOpen, false);
    await act(async () => { dom.window.history.back(); await wait(); });
    assert.equal(get().isOpen, true);
    assert.equal(document.querySelector('h3')!.textContent, 'Exit App?');
    assert.equal(document.activeElement?.textContent, 'Cancel');
    await act(async () => { dom.window.history.back(); await wait(); });
    assert.equal(get().isOpen, false, 'Back means Cancel while the dialog is open');
    await act(async () => { dom.window.history.back(); await wait(); });
    assert.equal(get().isOpen, true, 'Cancel must not disarm the boundary');
  });
});

test('root Back, repeated Back and Cancel never confirm an exit', async () => {
  await fixture('special-numbers', false, async (get, _, dom) => {
    for (let i = 0; i < 6; i++) {
      await act(async () => { dom.window.history.back(); await wait(); });
      assert.equal(get().isOpen, i % 2 === 0);
      assert.equal(dom.window.history.state.tab, 'special-numbers');
      assert.equal(document.querySelectorAll('[role="alertdialog"]').length, i % 2 === 0 ? 1 : 0);
    }
  });
});

test('Android closes layers even without WebView history and exits only from an explicit root confirmation', async () => {
  await fixture('songs', true, async (get, back, _, exits) => {
    await act(() => get().setLayer(true));
    await act(() => back(false));
    assert.equal(get().layer, false); assert.equal(get().current, 'songs'); assert.equal(get().isOpen, false);
    await act(() => back(false)); assert.equal(get().current, 'special-numbers'); assert.equal(get().isOpen, false);
    await act(() => back(true)); assert.equal(get().isOpen, true);
    await act(() => back(true)); assert.equal(get().isOpen, false);
    await act(() => { back(false); back(false); back(false); });
    assert.equal(get().isOpen, true); assert.equal(exits(), 0);
    await act(async () => { await get().confirmExit(); await get().confirmExit(); });
    assert.equal(exits(), 1);
  });
});

test('web Back closes its local modal before home navigation or exit', async () => {
  await fixture('songs', false, async (get, _, dom) => {
    await act(() => get().setLayer(true));
    await act(async () => { dom.window.history.back(); await wait(); });
    assert.equal(get().layer, false); assert.equal(get().current, 'songs'); assert.equal(get().isOpen, false);
    await act(async () => { dom.window.history.back(); await wait(); });
    assert.equal(get().current, 'special-numbers'); assert.equal(get().isOpen, false);
  });
});

test('a skipped modal boundary closes the modal instead of showing an exit dialog', async () => {
  await fixture('special-numbers', false, async (get, _, dom) => {
    await act(() => get().setLayer(true));
    await act(async () => { dom.window.history.go(-2); await wait(); });
    assert.equal(get().layer, false); assert.equal(get().isOpen, false);
    await act(async () => { dom.window.history.back(); await wait(); });
    assert.equal(get().isOpen, true);
  });
});

test('Android keyboard and action menus close before root exit confirmation', async () => {
  await fixture('special-numbers', true, async (get, back) => {
    const input = document.createElement('input'); document.body.append(input); input.focus(); document.documentElement.classList.add('keyboard-open');
    await act(() => back(false)); assert.ok(document.activeElement !== input); assert.equal(get().isOpen, false);
    document.documentElement.classList.remove('keyboard-open');
    const menu = document.createElement('div'); menu.dataset.setlistActions = 'one'; menu.innerHTML = '<button aria-expanded="true">Actions</button>'; document.body.append(menu);
    menu.addEventListener('keydown', () => menu.querySelector('button')!.setAttribute('aria-expanded', 'false'));
    await act(() => back(false)); assert.equal(get().isOpen, false);
    await act(() => back(false)); assert.equal(get().isOpen, true);
  });
});

test('web close/refresh has a browser fallback and a blocked Exit shows a close-tab message', async () => {
  await fixture('special-numbers', false, async (get, _, dom) => {
    const event = new dom.window.Event('beforeunload', { cancelable: true });
    dom.window.dispatchEvent(event); assert.equal(event.defaultPrevented, true);
    const originalClose = dom.window.close; dom.window.close = () => {};
    try {
      await act(async () => { dom.window.history.back(); await wait(); });
      await act(async () => { await get().confirmExit(); await new Promise(resolve => setTimeout(resolve, 400)); });
      assert.match(document.querySelector('#exit-app-description')!.textContent!, /You can now close this tab/);
      assert.equal(get().exiting, false);
      await act(() => get().cancel()); assert.equal(get().isOpen, false);
    } finally { dom.window.close = originalClose; }
  });
});

test('Escape cancels and only the Exit button invokes native exitApp', async () => {
  await fixture('special-numbers', true, async (get, back, dom, exits) => {
    await act(() => back(false));
    await act(() => document.activeElement!.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.equal(get().isOpen, false); assert.equal(exits(), 0);
    await act(() => back(false));
    await act(async () => [...document.querySelectorAll('button')].find(button => button.textContent === 'Exit')!.click());
    assert.equal(exits(), 1);
  });
});

test('exit UI covers signed-in, signed-out and loading states; predictive Back remains enabled', () => {
  const source = readFileSync('src/App.tsx', 'utf8');
  assert.equal((source.match(/<ExitConfirmation /g) || []).length, 3);
  assert.match(source, /useAppExitGuard\(currentTab, \(\) => setCurrentTab\('special-numbers'\)\)/);
  assert.match(readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8'), /android:enableOnBackInvokedCallback="true"/);
});
