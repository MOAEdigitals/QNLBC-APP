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

  const resize = () => {
    const textarea = localRef.current;
    if (!textarea) return;
    // Temporarily shrinking a tall textarea clamps its scroll container's position.
    // Restore that position after measuring, before the browser paints.
    const containers: Array<{ node: HTMLElement; top: number }> = [];
    for (let node = textarea.parentElement; node; node = node.parentElement) {
      if (node.scrollHeight > node.clientHeight) containers.push({ node, top: node.scrollTop });
    }
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
    for (const { node, top } of containers) node.scrollTop = top;
  };

  useLayoutEffect(resize, [value]);

  return (
    <textarea
      {...props}
      ref={assignRef}
      value={value}
      onChange={onChange}
      onSelect={onSelect}
      className={`resize-none overflow-hidden ${className}`}
    />
  );
});
