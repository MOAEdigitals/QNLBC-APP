import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { installUnsavedFormWarning } from '../src/utils/unsavedForms.ts';

test('browser close warns only for edited active forms, and clears after undo, cancel or form reset', async () => {
  const dom = new JSDOM('<main><input type="search"><form><input name="title" value="Original"><textarea name="lyrics">Words</textarea><input type="search"><input name="date" value="2026-11-08" class="ui-select-validation"><div contenteditable="true">Text</div></form></main>');
  const doc = dom.window.document, form = doc.querySelector('form')!;
  let suppress = false;
  const stop = installUnsavedFormWarning(dom.window as any, doc, () => suppress);
  const warns = () => { const event = new dom.window.Event('beforeunload', { cancelable: true }); dom.window.dispatchEvent(event); return event.defaultPrevented; };
  const settle = async () => { await new Promise(resolve => setTimeout(resolve, 0)); };
  try {
    assert.equal(warns(), false, 'browsing and an untouched editor do not warn');
    doc.querySelectorAll('input[type="search"]').forEach(input => (input as HTMLInputElement).value = 'query');
    assert.equal(warns(), false, 'searches are not drafts');
    const title = doc.querySelector<HTMLInputElement>('[name="title"]')!;
    title.value = 'Changed'; assert.equal(warns(), true);
    title.value = 'Original'; assert.equal(warns(), false, 'undoing the edit returns to a clean state');
    const date = doc.querySelector<HTMLInputElement>('[name="date"]')!;
    date.value = '2026-11-15'; assert.equal(warns(), true, 'sheet pickers use hidden validation values');
    date.value = '2026-11-08';
    const rich = doc.querySelector<HTMLElement>('[contenteditable]')!;
    rich.innerHTML = '<b>Text</b>'; assert.equal(warns(), true, 'formatting edits are drafts too');
    rich.innerHTML = 'Text';
    const optional = doc.createElement('input'); optional.name = 'optional'; form.append(optional); await settle();
    assert.equal(warns(), false, 'revealing a blank optional field is not an edit');
    optional.value = 'new value'; assert.equal(warns(), true);
    form.reset(); await settle(); assert.equal(warns(), false);
    title.value = 'Another edit'; suppress = true; assert.equal(warns(), false, 'an explicitly confirmed Exit is not interrupted'); suppress = false;
    form.remove(); await settle(); assert.equal(warns(), false, 'saved/cancelled editors no longer warn');
    const login = doc.createElement('div'); login.className = 'auth-screen'; login.innerHTML = '<form><input name="username"></form>'; doc.body.append(login); await settle();
    login.querySelector('input')!.value = 'signing in'; assert.equal(warns(), false);
    const next = doc.createElement('form'); next.innerHTML = '<textarea>New draft</textarea>'; doc.body.append(next); await settle();
    assert.equal(warns(), false); next.querySelector('textarea')!.value = 'Edited'; assert.equal(warns(), true);
    next.hidden = true; assert.equal(warns(), false, 'hidden editors are not pending work');
    stop(); next.hidden = false; assert.equal(warns(), false, 'unmount removes the warning listener');
  } finally { stop(); dom.window.close(); }
});
