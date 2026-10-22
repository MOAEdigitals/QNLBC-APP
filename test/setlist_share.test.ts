import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { PUBLIC_APP_URL, readSetlistShareId, setlistShareUrl } from '../src/utils/setlistSharing.ts';

const id = '11111111-1111-4111-8111-111111111111';
test('shared setlist URLs identify the saved card on the public web app and reject unrelated URLs', () => {
  const url = setlistShareUrl(id);
  assert.equal(url, `${PUBLIC_APP_URL}?setlist=${id}#home`);
  assert.equal(readSetlistShareId(url), id);
  assert.equal(readSetlistShareId(url.replace('moaedigitals.github.io', 'example.com')), null);
  assert.equal(readSetlistShareId(url.replace('/QNLBC-APP/', '/other/')), null);
  assert.equal(readSetlistShareId(`${PUBLIC_APP_URL}?setlist=not-an-id#home`), null);
  assert.equal(readSetlistShareId('javascript:alert(1)'), null);
  assert.throws(() => setlistShareUrl('../unsafe'));
  assert.equal(new URL(setlistShareUrl(id, 'https://app.example.com/?token=discard#old')).searchParams.has('token'), false);
});

function fixture(native = false, files = true) {
  const calls: any[] = [], writes: any[] = [];
  let cancel = false;
  const exports: any = {};
  const share = async (data: any) => { if (cancel) throw Object.assign(new Error('Cancelled'), { name: 'AbortError' }); calls.push(data); };
  runInNewContext(ts.transpileModule(readFileSync('src/services/setlistShare.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Error, navigator: { share, canShare: () => files },
    FileReader: class { result = 'data:image/png;base64,aW1hZ2U='; onload: any; readAsDataURL() { this.onload(); } },
    require: (name: string) => name === '@capacitor/core' ? { Capacitor: { isNativePlatform: () => native } }
      : name === '@capacitor/share' ? { Share: { share } }
      : { Directory: { Cache: 'CACHE' }, Filesystem: { writeFile: async (data: any) => { writes.push(data); return { uri: 'file:///cache/card.png' }; } } },
  });
  return { share: exports.shareSetlistContent, calls, writes, cancel: () => { cancel = true; } };
}
test('web share includes the card image and clickable URL, with link-only support and harmless cancellation', async () => {
  const image = { name: 'card.png' }, f = fixture();
  assert.equal(await f.share('Sunday Service', setlistShareUrl(id), image), 'shared');
  assert.equal(f.calls[0].files[0], image);
  assert.equal(f.calls[0].url, setlistShareUrl(id));
  const fallback = fixture(false, false);
  await fallback.share('Sunday Service', setlistShareUrl(id), image);
  assert.equal(fallback.calls[0].files, undefined);
  assert.equal(fallback.calls[0].url, setlistShareUrl(id));
  f.cancel();
  assert.equal(await f.share('Sunday Service', setlistShareUrl(id), image), 'cancelled');
});
test('Android shares its cached image with the URL in the text without sending automatically', async () => {
  const f = fixture(true);
  await f.share('Sunday Service', setlistShareUrl(id), { name: 'card.png' });
  assert.equal(f.writes[0].directory, 'CACHE');
  assert.equal(f.writes[0].data, 'aW1hZ2U=');
  assert.equal(f.calls[0].files[0], 'file:///cache/card.png');
  assert.ok(f.calls[0].text.includes(setlistShareUrl(id)));
  assert.equal(f.calls[0].dialogTitle, 'Share setlist');
});

test('App waits for login and authoritative core loading before consuming a shared setlist link', async () => {
  const { JSDOM } = await import('jsdom');
  const { createRequire } = await import('node:module');
  const dom = new JSDOM('<div id="root"></div>', { url: setlistShareUrl(id) });
  const keys = ['window', 'document', 'navigator', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT'];
  const previous = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  keys.forEach(key => Object.defineProperty(globalThis, key, { configurable: true, value: key === 'IS_REACT_ACT_ENVIRONMENT' ? true : (dom.window as any)[key] }));
  const require = createRequire(import.meta.url), React = require('react'), { act } = React;
  const root = require('react-dom/client').createRoot(document.getElementById('root'));
  const app = readFileSync('src/App.tsx', 'utf8').replace(/\r\n/g, '\n');
  const start = app.indexOf('  // Resolve shared links only after');
  const end = app.indexOf('  useEffect(() => {\n    const receive', start);
  assert.ok(start > 0 && end > start);
  const exports: any = {};
  const names = ['pendingSharedSetlist','currentUser','isLoadingInitialData','refreshError','setlists','sharedLinkRequest','loadedSectionsRef','rememberedSetlists','setInitialSelectedSetlistId','returnSetlistIdRef','savedSetlistScrollPosRef','setSetlistJourney','setSharedSetlistError','setCurrentTab','tabHistoryRef'];
  runInNewContext(ts.transpileModule(`function Bridge(props: any) { const { ${names.join(',')} } = props; ${app.slice(start,end)} return null; } exports.Bridge=Bridge;`, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, useEffect: React.useEffect, window: dom.window, URL });
  const selected: any[] = [], tabs: string[] = [], errors: string[] = [];
  const props: any = { pendingSharedSetlist: { current: id }, currentUser: null, isLoadingInitialData: false, refreshError: '', setlists: [], sharedLinkRequest: 0, loadedSectionsRef: { current: new Set() }, rememberedSetlists: { current: null }, returnSetlistIdRef: { current: null }, savedSetlistScrollPosRef: { current: null }, tabHistoryRef: { current: [] }, setInitialSelectedSetlistId: (value: any) => selected.push(value), setSetlistJourney() {}, setSharedSetlistError: (value: string) => errors.push(value), setCurrentTab: (value: string) => tabs.push(value) };
  const render = async () => act(() => root.render(React.createElement(exports.Bridge, { ...props })));
  try {
    await render(); assert.equal(selected.length, 0, 'signed-out visits preserve the destination');
    props.currentUser = { id: 'member' };
    await render(); assert.equal(selected.length, 0, 'auth events arriving before core loading do not report a missing record');
    props.isLoadingInitialData = true; props.loadedSectionsRef.current.add('home'); props.setlists = [{ id }];
    await render(); assert.equal(selected.length, 0);
    props.isLoadingInitialData = false;
    await render(); assert.deepEqual(selected, [id]); assert.deepEqual(Array.from(props.rememberedSetlists.current.ids), [id]); assert.deepEqual(tabs, ['home']);
    assert.equal(dom.window.location.search, '', 'the destination is consumed after opening');
    props.rememberedSetlists.current = { ids: [] }; props.setlists = [{ id }, { id: 'other' }];
    await render(); assert.equal(selected.length, 1, 'later refreshes do not reopen a manually collapsed card');
    props.pendingSharedSetlist.current = '22222222-2222-4222-8222-222222222222'; props.sharedLinkRequest++;
    await render(); assert.equal(selected.at(-1), null); assert.match(errors.at(-1)!, /unavailable/);
  } finally {
    await act(() => root.unmount()); dom.window.close();
    keys.forEach((key, index) => { if (previous[index]) Object.defineProperty(globalThis, key, previous[index]!); else delete (globalThis as any)[key]; });
  }
});
