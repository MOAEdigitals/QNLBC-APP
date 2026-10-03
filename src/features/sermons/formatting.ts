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
