import React, { useState, useRef, useEffect } from 'react';

interface AutofillInputProps {
  value: string;
  onChange: (val: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  required?: boolean;
  type?: string;
  onSelectSuggestion?: (val: string) => void;
  id?: string;
}

export const AutofillInput: React.FC<AutofillInputProps> = ({
  value,
  onChange,
  suggestions,
  placeholder,
  className = '',
  inputClassName = '',
  required = false,
  type = 'text',
  onSelectSuggestion,
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const cleanVal = (value || '').trim().toLowerCase();

  // Find matches
  const matches = suggestions.filter((s) => {
    if (!cleanVal) return false;
    return s.toLowerCase().includes(cleanVal);
  });

  // Check for inline ghost autocomplete (best prefix match)
  const bestPrefixMatch = suggestions.find((s) =>
    cleanVal && s.toLowerCase().startsWith(cleanVal) && s.length > (value || '').length
  );

  // Compute ghost suffix text
  const ghostSuffix = bestPrefixMatch ? bestPrefixMatch.slice((value || '').length) : '';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      if (matches.length > 0) {
        e.preventDefault();
        setIsOpen(true);
        setHighlightedIndex((prev) => (prev < matches.length - 1 ? prev + 1 : 0));
      }
    } else if (e.key === 'ArrowUp') {
      if (matches.length > 0) {
        e.preventDefault();
        setIsOpen(true);
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : matches.length - 1));
      }
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && matches[highlightedIndex]) {
        e.preventDefault();
        const selected = matches[highlightedIndex];
        onChange(selected);
        onSelectSuggestion?.(selected);
        setIsOpen(false);
        setHighlightedIndex(-1);
      } else if (bestPrefixMatch) {
        // Ghost autofill on Enter
        e.preventDefault();
        onChange(bestPrefixMatch);
        onSelectSuggestion?.(bestPrefixMatch);
        setIsOpen(false);
      } else if (matches.length > 0 && isOpen) {
        e.preventDefault();
        onChange(matches[0]);
        onSelectSuggestion?.(matches[0]);
        setIsOpen(false);
      }
    } else if (e.key === 'Tab' && bestPrefixMatch) {
      // Allow tab to complete ghost text
      e.preventDefault();
      onChange(bestPrefixMatch);
      onSelectSuggestion?.(bestPrefixMatch);
      setIsOpen(false);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleSelect = (val: string) => {
    onChange(val);
    onSelectSuggestion?.(val);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Ghost text display overlay behind input */}
      {bestPrefixMatch && (
        <div className="absolute inset-0 pointer-events-none flex items-center px-3 py-2 text-sm select-none overflow-hidden">
          <span className="opacity-0 whitespace-pre">{value}</span>
          <span className="text-slate-400/80 dark:text-slate-500 font-medium whitespace-pre">
            {ghostSuffix}
          </span>
          <span className="ml-auto text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
            ↵ Enter
          </span>
        </div>
      )}

      <input
        id={id}
        type={type}
        required={required}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
          setHighlightedIndex(-1);
        }}
        onFocus={() => {
          if (cleanVal && matches.length > 0) {
            setIsOpen(true);
          }
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`w-full bg-transparent ${inputClassName}`}
      />

      {/* Suggestion Dropdown */}
      {isOpen && matches.length > 0 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1 divide-y divide-slate-100 dark:divide-slate-800">
          {matches.map((item, idx) => {
            const isSelected = idx === highlightedIndex;
            return (
              <button
                key={item + idx}
                type="button"
                onMouseDown={() => handleSelect(item)}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={`w-full px-3 py-2 text-left text-xs sm:text-sm flex items-center justify-between cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <span>{item}</span>
                <span className="text-[10px] text-slate-400">Select</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
