import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><body></body></html>');
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, DOMParser: dom.window.DOMParser });
const { sanitizeOutline, plainTextHtml } = await import('../src/features/sermons/formatting.ts');
const { listSermons, sermonPayload } = await import('../src/features/sermons/model.ts');

test('formatted outline keeps bold, bullet nesting, numbered-list start, spaces and tabs', () => {
  const html = '<p>  Title\t<strong>Grace</strong>  *</p><ul><li><p>First</p><ul><li>Nested</li></ul></li></ul><ol start="4"><li>Fourth</li></ol><p><span style="color:rgb(26, 125, 163);font-weight:700">John 3:16</span></p>';
  const result = sanitizeOutline(html);
  const doc = new JSDOM(result).window.document;
  assert.equal(doc.querySelector('p')?.textContent, '  Title\tGrace  *');
  assert.equal(doc.querySelector('strong')?.textContent, 'Grace');
  assert.equal(doc.querySelectorAll('ul').length, 2);
  assert.equal(doc.querySelector('ol')?.getAttribute('start'), '4');
  assert.equal((doc.querySelector('span') as HTMLElement).style.fontWeight, '700');
});
test('sanitizer removes scripts, handlers, remote images and unsafe styles', () => {
  const result = sanitizeOutline('<p onclick="alert(1)" style="background-image:url(https://example.com/track);position:fixed;color:blue">Text</p><script>alert(1)</script><img src="https://example.com/track"><iframe src="https://example.com"></iframe>');
  assert.doesNotMatch(result, /script|onclick|<img|iframe|url\(|position/);
  assert.match(result, /color: blue/);
});
test('legacy plain text renders literally with tabs, spaces, asterisks and blank lines', () => {
  const text = '  Title\t*literal*\n\n  <b>not HTML</b>  ';
  const html = plainTextHtml(text);
  const doc = new JSDOM(html).window.document;
  assert.equal(doc.querySelectorAll('p').length, 3);
  assert.equal(doc.querySelectorAll('b').length, 0);
  assert.equal(doc.querySelectorAll('p')[2].textContent, '  <b>not HTML</b>  ');
});
test('unified sermon list puts current entries first and done or past entries last', () => {
  const base = { id: '', author_id: '', title: '', preacher: '', outline: '', status: 'published' as const, revision: 1, created_at: '', updated_at: '' };
  const rows = [{ ...base, id: 'past', service_date: '2026-09-01' }, { ...base, id: 'done', service_date: '2026-10-20', is_done: true }, { ...base, id: 'future', service_date: '2026-10-11' }, { ...base, id: 'today', service_date: '2026-10-03' }];
  assert.deepEqual(listSermons(rows, '2026-10-03', '').map(row => row.id), ['today', 'future', 'done', 'past']);
});
test('an attachment-only sermon can save without outline text', () => {
  const input = { service_date: '2026-10-04', title: 'Grace', preacher: 'Preacher', outline: '', status: 'draft' as const, attachments: [{ id: 'id', name: 'Grace.pdf', path: 'author/sermon/file.pdf', kind: 'pdf' as const, size: 42 }] };
  assert.equal(sermonPayload(input).outline, '');
  assert.equal(sermonPayload(input).attachments?.length, 1);
});
