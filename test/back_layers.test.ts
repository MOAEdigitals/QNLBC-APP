import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { useBackLayer } from '../src/hooks/useBackLayer.ts';
import fs from 'node:fs';
import path from 'node:path';
const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.com/#songs' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
const wait = () => new Promise(resolve => setTimeout(resolve, 40));
let ui: any;
function Fixture() {
  const [reader, setReader] = React.useState(false);
  const [editor, setEditor] = React.useState(false);
  const [blocked, setBlocked] = React.useState(false);
  useBackLayer(editor, () => { if (!blocked) setEditor(false); });
  useBackLayer(reader, () => setReader(false));
  ui = { reader, editor, blocked, setReader, setEditor, setBlocked };
  return null;
}
test('Back closes the top screen first, respects saving, and consumes manual-close history', async () => {
  const root = createRoot(document.getElementById('root')!);
  let parentPops = 0;
  const parent = () => parentPops++;
  window.history.replaceState({ tab: 'songs' }, '');
  await act(async () => root.render(React.createElement(Fixture)));
  window.addEventListener('popstate', parent);
  await act(async () => ui.setReader(true));
  await act(async () => ui.setEditor(true));
  await act(async () => { window.history.back(); await wait(); });
  assert.equal(ui.editor, false); assert.equal(ui.reader, true); assert.equal(parentPops, 0);
  await act(async () => { window.history.back(); await wait(); });
  assert.equal(ui.reader, false); assert.equal(parentPops, 0);
  await act(async () => { ui.setEditor(true); ui.setBlocked(true); });
  await act(async () => { window.history.back(); await wait(); });
  assert.equal(ui.editor, true); assert.match(window.history.state.localScreen, /^local-screen/);
  await act(async () => ui.setBlocked(false));
  await act(async () => { window.history.back(); await wait(); });
  assert.equal(ui.editor, false);
  await act(async () => ui.setEditor(true));
  await act(async () => ui.setEditor(false));
  await act(async () => { await wait(); });
  assert.equal(parentPops, 0);
  assert.equal(window.history.state?.localScreen, undefined);
  await act(async () => root.unmount());
  window.removeEventListener('popstate', parent);
});

test('schedule subtabs do not become Back layers that reset to Song Numbers', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'src/components/SpecialNumberTab.tsx'),
    'utf8',
  ).replace(/\r\n/g, '\n');
  assert.doesNotMatch(
    source,
    /useBackLayer\(activeSubTab !== 'schedules',[\s\S]*?setActiveSubTab\('schedules'\)/,
  );
  assert.match(source, /useBackLayer\(isEditingSchedule/);
});

test('section tabs do not hijack Back and full-screen views use one Back system', () => {
  const special = fs.readFileSync(path.join(process.cwd(), 'src/components/SpecialNumberTab.tsx'), 'utf8').replace(/\r\n/g, '\n');
  const recognitions = fs.readFileSync(path.join(process.cwd(), 'src/components/RecognitionsTab.tsx'), 'utf8').replace(/\r\n/g, '\n');
  const songs = fs.readFileSync(path.join(process.cwd(), 'src/components/SongsTab.tsx'), 'utf8').replace(/\r\n/g, '\n');
  const setlists = fs.readFileSync(path.join(process.cwd(), 'src/components/SetlistsTab.tsx'), 'utf8').replace(/\r\n/g, '\n');
  const settings = fs.readFileSync(path.join(process.cwd(), 'src/components/SettingsTab.tsx'), 'utf8').replace(/\r\n/g, '\n');
  assert.doesNotMatch(special, /useBackLayer\(activeSubTab/);
  assert.doesNotMatch(recognitions, /useBackLayer\(subTab/);
  assert.doesNotMatch(songs, /addEventListener\('popstate'/);
  assert.doesNotMatch(setlists, /addEventListener\('popstate'/);
  assert.match(setlists, /useBackLayer\(isEditing \|\| !!selectedSetlistId/);
  assert.match(settings, /useBackLayer\(showPromptModal \|\| !!selectedMemberId \|\| !!settingsSection/);
});
