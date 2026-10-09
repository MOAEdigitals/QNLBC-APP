import React, { forwardRef, useLayoutEffect, useRef } from 'react';

type Props = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const AutoGrowTextarea = forwardRef<HTMLTextAreaElement, Props>(function AutoGrowTextarea(
  { className = '', value, onChange, onSelect, ...props },
  forwardedRef,
) {
  const localRef = useRef<HTMLTextAreaElement | null>(null);

  const assignRef = (node: HTMLTextAreaElement | null) => {
    localRef.current = node;
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  };

  const revealEnd = () => {
    const textarea = localRef.current;
    if (!textarea || document.activeElement !== textarea || textarea.selectionEnd !== textarea.value.length) return;
    const form = textarea.closest('form');
    if (!form) return;
    const bottom = Math.min(form.getBoundingClientRect().bottom, window.visualViewport?.height ?? window.innerHeight) - 96;
    const overflow = textarea.getBoundingClientRect().bottom - bottom;
    if (overflow > 0) form.scrollTop += overflow;
  };
  const resize = () => {
    const textarea = localRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  useLayoutEffect(() => {
    const textarea = localRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      {...props}
      ref={assignRef}
      value={value}
      onChange={(event) => {
        onChange?.(event);
        requestAnimationFrame(() => { resize(); revealEnd(); });
      }}
      onSelect={(event) => { onSelect?.(event); requestAnimationFrame(revealEnd); }}
      className={`resize-none overflow-hidden ${className}`}
    />
  );
});
