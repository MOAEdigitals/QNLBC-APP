import { bibleReferences } from './autoFormat.ts';
import DOMPurify from 'dompurify';

export function escapeText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
export function plainTextHtml(text: string): string {
  return text.split('\n').map(line => `<p>${escapeText(line) || '<br>'}</p>`).join('');
}
export function sanitizeOutline(html: string): string {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'div', 'span', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'ol', 'ul', 'li', 'blockquote', 'pre', 'code', 'hr'],
    ALLOWED_ATTR: ['style', 'start', 'type'],
    ALLOW_DATA_ATTR: false,
  });
  const root = document.createElement('div');
  root.innerHTML = clean;
  const properties = ['color', 'background-color', 'font-size', 'font-family', 'font-weight', 'font-style', 'text-decoration', 'text-align', 'margin-left', 'text-indent', 'line-height'];
  root.querySelectorAll<HTMLElement>('[style]').forEach(element => {
    const values = properties.map(property => [property, element.style.getPropertyValue(property)]);
    element.removeAttribute('style');
    for (const [property, value] of values) {
      if (value && !/url\s*\(|expression\s*\(|var\s*\(/i.test(value)) element.style.setProperty(property, value);
    }
  });
  return root.innerHTML;
}

/** Display notation without changing the editable source or interpreting HTML. */
export function renderOutline(html: string | null | undefined, text: string): string {
  const root = document.createElement('div');
  root.innerHTML = html ? sanitizeOutline(html) : plainTextHtml(text);
  const walker = document.createTreeWalker(root, 4);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    if (node.parentElement?.closest('pre, code')) continue;
    const source = node.data;
    const pattern = /(?<![\\*])(\*+)([^*\n]+?)\1(?!\*)/g;
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (const match of source.matchAll(pattern)) {
      if (!match[2].trim()) continue;
      fragment.append(document.createTextNode(source.slice(cursor, match.index)));
      const strong = document.createElement('strong');
      strong.textContent = match[2];
      // Each additional pair increases size, capped to remain readable on phones.
      strong.style.fontSize = `${Math.min(2, 1 + (match[1].length - 1) * 0.2)}em`;
      fragment.append(strong);
      cursor = match.index! + match[0].length;
    }
    if (cursor) {
      fragment.append(document.createTextNode(source.slice(cursor)));
      node.replaceWith(fragment);
    }
  }
  return root.innerHTML;
}

/** Apply reference/verse color without rewriting text, indentation or rich marks. */
export function colorOutlineVerses(html: string | null | undefined, text: string): string {
  const root = document.createElement('div');
  root.innerHTML = html ? sanitizeOutline(html) : plainTextHtml(text);
  const blocks = root.querySelectorAll<HTMLElement>('p, h1, h2, h3, h4, li, div, blockquote');
  let verseBlock = false;
  for (const block of blocks) {
    if (block.querySelector('p, h1, h2, h3, h4, li, div, blockquote') || block.closest('pre, code')) continue;
    const value = block.textContent || '';
    const references = bibleReferences(value);
    const first = references[0];
    const prefix = first ? value.slice(0, first.from).replace(/[\s*"“”'‘’()[\]—–-]/g, '') : '';
    const quoted = /^\s*[*]*["“]/.test(value) && references.length > 0;
    const numberedContinuation = verseBlock && /^\s*\d{1,3}[.)]?\s+\S/.test(value);
    if ((first && !prefix) || quoted || numberedContinuation) {
      block.style.color = '#197aa3';
      // Existing inline colors must not override verse blue.
      block.querySelectorAll<HTMLElement>('[style]').forEach(child => child.style.removeProperty('color'));
      verseBlock = true;
      continue;
    }
    verseBlock = false;
    if (!references.length) continue;
    const walker = document.createTreeWalker(block, 4);
    const nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    let offset = 0;
    for (const node of nodes) {
      const start = offset;
      offset += node.length;
      if (node.parentElement?.closest('code')) continue;
      if (node.parentElement?.style.color === 'rgb(25, 122, 163)') continue;
      const fragment = document.createDocumentFragment();
      let cursor = 0;
      for (const reference of references) {
        const from = Math.max(0, reference.from - start);
        const to = Math.min(node.length, reference.to - start);
        if (to <= from) continue;
        fragment.append(document.createTextNode(node.data.slice(cursor, from)));
        const span = document.createElement('span');
        span.style.color = '#197aa3';
        span.textContent = node.data.slice(from, to);
        fragment.append(span);
        cursor = to;
      }
      if (cursor) {
        fragment.append(document.createTextNode(node.data.slice(cursor)));
        node.replaceWith(fragment);
      }
    }
  }
  return root.innerHTML;
}
