import React, { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { BottomSheet } from './BottomSheet';

type Props = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'multiple' | 'size'> & { scrollToSelected?: boolean };
export function SheetSelect({ children, value, defaultValue, onChange, disabled, required, className = '', id, name, form, scrollToSelected = false, ...props }: Props) {
  const generatedId = useId();
  const root = useRef<HTMLSpanElement>(null);
  const selectedOption = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false), [query, setQuery] = useState(''), [title, setTitle] = useState('Choose an option');
  const [local, setLocal] = useState(String(defaultValue ?? ''));
  const selected = String(value ?? local);
  const options = useMemo(() => {
    const result: { value: string; label: string; disabled: boolean }[] = [];
    const text = (node: React.ReactNode): string => React.Children.toArray(node).map(child => React.isValidElement(child) ? text((child.props as any).children) : String(child ?? '')).join('');
    const visit = (nodes: React.ReactNode, inheritedDisabled = false) => React.Children.forEach(nodes, child => {
      if (!React.isValidElement(child)) return;
      const option = child.props as any;
      if (child.type === 'option') result.push({ value: String(option.value ?? text(option.children)), label: text(option.children), disabled: inheritedDisabled || !!option.disabled });
      else visit(option.children, inheritedDisabled || !!option.disabled);
    });
    visit(children); return result;
  }, [children]);
  useLayoutEffect(() => {
    if (!open || !scrollToSelected) return;
    const option = selectedOption.current;
    const body = option?.closest<HTMLElement>('.ui-sheet-body');
    if (!option || !body) return;
    const searchHeight = body.querySelector('.ui-sheet-search')?.getBoundingClientRect().height || 0;
    body.scrollTop += option.getBoundingClientRect().top - body.getBoundingClientRect().top - searchHeight;
  }, [open, scrollToSelected, selected]);
  const label = options.find(option => option.value === selected)?.label || 'Choose an option';
  const close = () => { setOpen(false); setQuery(''); };
  const show = () => {
    if (disabled) return;
    const outer = root.current?.closest('label');
    const labelText = outer ? Array.from(outer.childNodes).filter(node => node !== root.current).map(node => node.textContent || '').join(' ').trim() : id ? Array.from(document.querySelectorAll('label')).find(label => label.htmlFor === id)?.textContent?.trim() : '';
    setTitle(props['aria-label'] || labelText || 'Choose an option'); setQuery(''); setOpen(true);
  };
  return <span ref={root} className="ui-sheet-select-root">
    <button {...props as unknown as React.ButtonHTMLAttributes<HTMLButtonElement>} id={id || generatedId} type="button" disabled={disabled} className={`ui-sheet-select ${className}`} aria-haspopup="dialog" aria-expanded={open} aria-required={required || undefined} onClick={show} onKeyDown={event => { if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); show(); } }}>
      <span className="min-w-0 flex-1 truncate">{label}</span><ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
    </button>
    <input type="text" tabIndex={-1} aria-hidden="true" className="ui-select-validation" name={name} form={form} value={selected} required={required} disabled={disabled} onChange={() => {}} onInvalid={event => { event.preventDefault(); show(); }} />
    <BottomSheet open={open} title={title} onClose={close} onBack={() => query ? setQuery('') : close()}>
      {options.length > 7 && <label className="ui-sheet-search" style={scrollToSelected ? { position: 'sticky', top: 0, zIndex: 1, background: 'var(--ui-surface)' } : undefined}><Search className="h-4 w-4 shrink-0" /><input type="search" aria-label={`Search ${title}`} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search options" autoComplete="off" />{query && <button type="button" aria-label="Clear options search" onClick={() => setQuery('')}><X className="h-4 w-4" /></button>}</label>}
      <div className="ui-sheet-options">{options.filter(option => option.label.toLowerCase().includes(query.trim().toLowerCase())).map((option, index) => <button key={`${option.value}-${index}`} type="button" ref={option.value === selected ? selectedOption : undefined} className="ui-sheet-option" disabled={option.disabled} aria-pressed={option.value === selected} onClick={() => {
        setLocal(option.value); onChange?.({ target: { value: option.value }, currentTarget: { value: option.value } } as React.ChangeEvent<HTMLSelectElement>); close();
      }}><span className="min-w-0 flex-1 break-words">{option.label}</span>{option.value === selected && <Check className="h-5 w-5 shrink-0" />}</button>)}</div>
      {!options.some(option => option.label.toLowerCase().includes(query.trim().toLowerCase())) && <p className="p-6 text-center text-sm text-slate-400">No matching options.</p>}
    </BottomSheet>
  </span>;
}
