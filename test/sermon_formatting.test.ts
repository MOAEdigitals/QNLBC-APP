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

const { bibleReferences, outlineLineStyle } = await import('../src/features/sermons/autoFormat.ts');
test('formatter detects title, headings and points while leaving explanations regular', () => {
  assert.equal(outlineLineStyle("The Refiner's Fire", true, false), 'title');
  assert.equal(outlineLineStyle('Introduction: When God Puts the Heart in the Fire', false, false), 'point');
  assert.equal(outlineLineStyle('1. The fire reveals what is really in the heart.', false, false), 'point');
  assert.equal(outlineLineStyle('God uses trials to reveal what is within us.', false, false), null);
  assert.equal(outlineLineStyle('Conclusion:', false, false), 'point');
  assert.equal(outlineLineStyle('Proverbs 17:3', true, false), null);
  assert.equal(outlineLineStyle('Psalm 139:23–24', false, true), null);
});
test('formatter finds multiple Bible references and preserves offsets, prefixes and ranges', () => {
  const text = '\tJob 23:10; 1 Peter 1:6–7 and Hebrews 12:10–11  ';
  assert.deepEqual(bibleReferences(text).map(r => text.slice(r.from, r.to)), ['Job 23:10', '1 Peter 1:6–7', 'Hebrews 12:10–11']);
  assert.deepEqual(bibleReferences('Meet at 12:30; point 1.'), []);
});

const { renderOutline } = await import('../src/features/sermons/formatting.ts');
test('asterisk pairs render bold with increasing sizes and preserve paragraph layout', () => {
  const result = new JSDOM(renderOutline(null, '*Bold* **Larger** ***Heading***\n\nNormal')).window.document;
  const marks = [...result.querySelectorAll('strong')];
  assert.deepEqual(marks.map(mark => mark.textContent), ['Bold', 'Larger', 'Heading']);
  assert.deepEqual(marks.map(mark => mark.style.fontSize), ['1em', '1.2em', '1.4em']);
  assert.equal(result.querySelectorAll('p').length, 3);
});
test('malformed markers stay literal and enclosed HTML remains safe text', () => {
  const result = new JSDOM(renderOutline(null, '*unclosed\n**mismatch*\n*<img src=x>*')).window.document;
  assert.ok(result.body.textContent?.includes('**mismatch*'));
  assert.equal(result.querySelector('img'), null);
  assert.equal(result.querySelector('strong')?.textContent, '<img src=x>');
});
test('rich lists retain formatting, code stays literal and size is capped', () => {
  const result = new JSDOM(renderOutline('<ul><li><span style="color:blue">**Point**</span></li></ul><pre>*code*</pre><p>********Huge********</p>', '')).window.document;
  assert.equal(result.querySelector('li strong')?.textContent, 'Point');
  assert.equal(result.querySelector('pre')?.textContent, '*code*');
  assert.equal((result.querySelector('p strong') as HTMLElement).style.fontSize, '2em');
});

const { colorOutlineVerses } = await import('../src/features/sermons/formatting.ts');
test('saved English and Tagalog verses automatically become blue', () => {
 const html=colorOutlineVerses(null, 'John 3:16 For God so loved the world.\n\nJuan 3:16 Sapagkat gayon na lamang ang pag-ibig ng Diyos.\n\nMga Awit 23:1 Ang Panginoon ang aking pastor.');
 const doc=new JSDOM(html).window.document;
 for(const index of [0,2,4]) assert.equal((doc.querySelectorAll('p')[index] as HTMLElement).style.color,'rgb(25, 122, 163)');
});
test('inline references and split rich text turn blue without coloring ordinary explanations',()=>{
 const html=colorOutlineVerses('<p>Consider <b>Juan</b> 3:16 today.</p><p>Normal explanation</p>', '');
 const doc=new JSDOM(html).window.document;
 assert.equal((doc.querySelector('p') as HTMLElement).style.color,'');
 assert.equal(doc.querySelectorAll('span').length,2);
 assert.equal(colorOutlineVerses(html, ''), html);
 assert.equal(doc.querySelector('b')?.textContent,'Juan');
 assert.equal(doc.querySelectorAll('p')[1].textContent,'Normal explanation');
});
test('verse coloring preserves asterisks and numbered continuation, and repeated saves are stable',()=>{
 const text='**Roma 8:1** Ngayon ay wala nang hatol.\n2 Sapagkat ang kautusan...\n\nI. Application';
 const once=colorOutlineVerses(null,text);
 assert.equal(colorOutlineVerses(once,text),once);
 const doc=new JSDOM(once).window.document;
 assert.equal(doc.querySelector('p')?.textContent,'**Roma 8:1** Ngayon ay wala nang hatol.');
 assert.equal((doc.querySelectorAll('p')[1] as HTMLElement).style.color,'rgb(25, 122, 163)');
 assert.equal((doc.querySelectorAll('p')[3] as HTMLElement).style.color,'');
});


test('pasted black text and white page backgrounds follow the theme, while colored ink gets readable variants', () => {
  const html = sanitizeOutline('<p style="background-color:white;color:black"><strong>Imported text</strong><span style="color:#197aa3">John 3:16</span></p>');
  const root = document.createElement('div'); root.innerHTML = html;
  const paragraph = root.querySelector('p')!, span = root.querySelector('span')!;
  assert.equal(paragraph.style.backgroundColor, '');
  assert.equal(paragraph.getAttribute('data-outline-ink'), '');
  assert.equal(paragraph.style.getPropertyValue('--outline-dark-ink'), 'inherit');
  assert.match(span.style.getPropertyValue('--outline-dark-ink'), /^rgb/);
  assert.notEqual(span.style.getPropertyValue('--outline-dark-ink'), span.style.color);
  assert.equal(sanitizeOutline(html), html, 'repeated edit/save does not accumulate style changes');
});

test('outline search prioritizes titles, then finds text across lines and rich-only legacy content', () => {
  const base = { id: '', author_id: '', title: '', preacher: 'Bro Ronnie', outline: '', status: 'published' as const, revision: 1, created_at: '', updated_at: '' };
  const rows = [
    { ...base, id: 'body', title: 'Trials', service_date: '2026-10-25', outline: 'God gives\n  lasting hope.' },
    { ...base, id: 'title', title: 'Lasting hope', service_date: '2026-11-01' },
    { ...base, id: 'rich', title: 'Grace', service_date: '2026-11-02', outline_html: '<p>Lasting&nbsp;<b>hope</b></p>' },
    { ...base, id: 'none', title: 'Prayer', service_date: '2026-10-26', outline: 'Different words' },
  ];
  assert.deepEqual(listSermons(rows, '2026-10-24', 'LASTING hope').map(row => row.id), ['title', 'body', 'rich']);
  assert.deepEqual(listSermons(rows, '2026-10-24', 'color').map(row => row.id), []);
});


test('yellow highlights keep dark contrast ink, including nested imported white text', () => {
  const html = sanitizeOutline('<p><span style="background-color:#ffff00;color:white">Baptism <strong><span style="color:white">by immersion</span></strong></span></p>');
  const root = document.createElement('div'); root.innerHTML = html;
  const highlight = root.querySelector('[data-outline-highlight]') as HTMLElement;
  assert.ok(highlight);
  assert.equal(highlight.style.getPropertyValue('--outline-highlight-ink'), '#0f172a');
  assert.equal(highlight.style.backgroundColor, 'rgb(255, 255, 0)');
  assert.equal(root.textContent, 'Baptism by immersion');
  assert.equal(sanitizeOutline(html), html);
});
