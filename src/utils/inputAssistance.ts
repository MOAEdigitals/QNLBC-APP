/** Request no saved-entry suggestions. Browser-owned password UI may override this. */
export function installInputAssistance(root: Document = document): () => void {
  const selector = 'form,input,textarea,[contenteditable="true"]';
  const configure = (element: Element) => {
    if (element.matches('form,input,textarea')) element.setAttribute('autocomplete', 'off');
    if (element.matches('input,textarea,[contenteditable="true"]')) {
      element.setAttribute('data-form-type', 'other');
      element.setAttribute('data-lpignore', 'true');
      element.setAttribute('data-1p-ignore', 'true');
      element.setAttribute('data-bwignore', 'true');
    }
  };
  const scan = (element: Element | Document) => {
    if (element instanceof Element && element.matches(selector)) configure(element);
    element.querySelectorAll(selector).forEach(configure);
  };
  scan(root);
  const observer = new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) {
      if (node instanceof Element) scan(node);
    }
  });
  observer.observe(root.documentElement, { childList: true, subtree: true });
  const onFocus = (event: Event) => {
    if (event.target instanceof Element && event.target.matches(selector)) configure(event.target);
  };
  root.addEventListener('focusin', onFocus, true);
  return () => { observer.disconnect(); root.removeEventListener('focusin', onFocus, true); };
}
