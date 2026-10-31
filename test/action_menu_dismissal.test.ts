import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { JSDOM } from 'jsdom';
import ts from 'typescript';

function effect(path: string, marker: string, endMarker: string) {
  const source = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
  const start = source.indexOf('  useEffect(', source.indexOf(marker));
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `Find menu effect in ${path}`);
  return ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
}
const cases = [
  ['song attachments', 'src/components/SongsTab.tsx', '// Capture outside interactions', '\n\n  const lastProcessedSignalRef', 'data-attachment-actions', 'setOpenAttachmentMenuId'],
  ['song options', 'src/components/SongsTab.tsx', '// Capture outside interactions', '\n\n  const lastProcessedSignalRef', 'data-song-actions', 'setOpenMenuSongId'],
  ['setlists', 'src/components/SetlistsTab.tsx', '// Capture pointer events', '\n\n  // Notify parent', 'data-setlist-actions', 'setOpenMenuSetlistId'],
  ['birthdays', 'src/components/RecognitionsTab.tsx', '  useEffect(() => {\n    if (!birthdayMenuId)', '\n\n  const [birthdaySearchQuery', 'data-birthday-actions', 'setBirthdayMenuId'],
  ['activities', 'src/features/activities/Activities.tsx', '  useEffect(() => {\n    if (!openMenu)', '\n\n  useEffect(', 'data-activity-actions', 'setOpenMenu'],
  ['practice audio tracks', 'src/components/PracticeAudioTrackRow.tsx', '// Close menu when clicking outside', '\n\n  // Format seconds', 'data-audio-actions', 'setIsMenuOpen'],
] as const;

for (const [name, path, marker, end, attribute, setter] of cases) test(`${name}: outside taps and keyboard clicks close despite stopped propagation; actions remain clickable`, () => {
  const dom = new JSDOM(`<div id="outside"><button>Elsewhere</button></div><div id="menu" ${attribute}="active"><button id="edit">Edit</button></div><button id="other">Another menu</button>`);
  let closed = 0, acted = 0; let cleanup: () => void = () => {};
  const menu = dom.window.document.getElementById('menu')!;
  const outside = dom.window.document.getElementById('outside')!;
  for (const type of ['pointerdown','click']) outside.addEventListener(type, event => event.stopPropagation());
  dom.window.document.getElementById('edit')!.addEventListener('click', () => acted++);
  const no = () => {};
  const context: any = {
    document: dom.window.document, window: dom.window,
    useEffect: (fn: () => () => void) => { cleanup = fn(); },
    menuRef: { current: menu }, isMenuOpen: true,
    openMenuSongId: attribute === 'data-song-actions' ? 'active' : null,
    openAttachmentMenuId: attribute === 'data-attachment-actions' ? 'active' : null,
    categoryPickerSongId: null, openMenuSetlistId: 'active', showTypeSelector: false,
    birthdayMenuId: 'active', openMenu: 'active',
    setOpenMenuSongId: no, setOpenAttachmentMenuId: no, setCategoryPickerSongId: no,
    setOpenMenuSetlistId: no, setShowTypeSelector: no, setBirthdayMenuId: no, setOpenMenu: no, setIsMenuOpen: no,
  };
  context[setter] = () => closed++;
  try {
    runInNewContext(effect(path, marker, end), context);
    menu.querySelector('button')!.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true }));
    menu.querySelector('button')!.click();
    assert.equal(closed, 0, 'inside interaction must not dismiss before the chosen action'); assert.equal(acted, 1);
    outside.querySelector('button')!.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true }));
    assert.equal(closed, 1, 'capture phase bypasses a card stopping propagation');
    outside.querySelector('button')!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, detail: 0 }));
    assert.equal(closed, 2, 'keyboard-generated clicks dismiss too');
    dom.window.document.getElementById('other')!.click(); assert.equal(closed, 3, 'opening another menu closes this one');
    menu.querySelector('button')!.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(closed, 4);
    cleanup(); outside.querySelector('button')!.click(); assert.equal(closed, 4, 'listeners are removed on cleanup');
  } finally { cleanup(); dom.window.close(); }
});

for (const [name, path, marker, end] of [
  ['shared card actions','src/components/CardActions.tsx','const menu =','\n  if (!onEdit'],
  ['practice sessions','src/components/SpecialNumberTab.tsx','// Native <details> menus','\n\n  const toggleScheduleLyricsExpand'],
]) test(`${name}: native details menus close outside even when the target stops propagation`, () => {
  const dom = new JSDOM('<button id="outside">Outside</button><details class="practice-actions" open><summary>Actions</summary><button>Edit</button></details>');
  const details = dom.window.document.querySelector('details')!; let cleanup: () => void = () => {};
  const outside = dom.window.document.getElementById('outside')!;
  outside.addEventListener('pointerdown', event => event.stopPropagation());
  try {
    runInNewContext(effect(path, marker, end), { document: dom.window.document, menu: { current: details }, useEffect: (fn: () => () => void) => { cleanup = fn(); } });
    details.querySelector('button')!.click(); assert.equal(details.open, true, 'inside click must reach the action handler');
    outside.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true })); assert.equal(details.open, false);
    details.open = true; outside.click(); assert.equal(details.open, false);
    details.open = true; details.querySelector('summary')!.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); assert.equal(details.open, false);
    cleanup(); details.open = true; outside.click(); assert.equal(details.open, true);
  } finally { cleanup(); dom.window.close(); }
});
