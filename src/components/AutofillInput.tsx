import React, { useState, useRef, useEffect } from 'react';

interface AutofillInputProps {
  value: string;
  onChange: (val: string) => void;
  suggestions: string[]; // Primary suggestions (e.g. marked welcome/closing songs)
  allSuggestions?: string[]; // Fallback full library suggestions when user types
  defaultValue?: string; // Default song (e.g. 'Napakaligaya' or 'Give Thanks')
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  required?: boolean;
  type?: string;
  onSelectSuggestion?: (val: string) => void;
  id?: string;
  showAllOnFocus?: boolean;
}

export const AutofillInput: React.FC<AutofillInputProps> = ({
  value,
  onChange,
  suggestions,
  allSuggestions,
  defaultValue,
  placeholder,
  className = '',
  inputClassName = '',
  required = false,
  type = 'text',
  onSelectSuggestion,
  id,
  showAllOnFocus = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const cleanVal = (value || '').trim().toLowerCase();
  const cleanDefault = (defaultValue || '').trim().toLowerCase();

  // Determine suggestions list based on user typing & defaults
  let displayedItems: string[] = [];

  if (allSuggestions && allSuggestions.length > 0) {
    // 1. If empty or matching default value, show marked badge songs only
    if (!cleanVal || (cleanDefault && cleanVal === cleanDefault)) {
      displayedItems = suggestions;
    } else {
      // 2. If user deleted default or typed custom text, search across the whole song list
      const filteredAll = allSuggestions.filter((s) =>
        s.toLowerCase().includes(cleanVal)
      );

      // Prioritize marked badge songs that match the search query, then the rest
      const primaryMatches = suggestions.filter((s) =>
        s.toLowerCase().includes(cleanVal)
      );
      const otherMatches = filteredAll.filter((s) => !primaryMatches.includes(s));

      displayedItems = [...primaryMatches, ...otherMatches];
    }
  } else {
    // Standard single-list autofill
    if (!cleanVal) {
      displayedItems = showAllOnFocus ? suggestions : [];
    } else {
      displayedItems = suggestions.filter((s) =>
        s.toLowerCase().includes(cleanVal)
      );
    }
  }

  // Active pool for prefix match
  const searchPool = allSuggestions && allSuggestions.length > 0 ? allSuggestions : suggestions;
  const bestPrefixMatch = searchPool.find(
    (s) =>
      cleanVal &&
      s.toLowerCase().startsWith(cleanVal) &&
      s.length > (value || '').length
  );

  // Compute ghost suffix text
  const ghostSuffix = bestPrefixMatch
    ? bestPrefixMatch.slice((value || '').length)
    : '';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      if (displayedItems.length > 0) {
        e.preventDefault();
        setIsOpen(true);
        setHighlightedIndex((prev) =>
          prev < displayedItems.length - 1 ? prev + 1 : 0
        );
      }
    } else if (e.key === 'ArrowUp') {
      if (displayedItems.length > 0) {
        e.preventDefault();
        setIsOpen(true);
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : displayedItems.length - 1
        );
      }
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && displayedItems[highlightedIndex]) {
        e.preventDefault();
        const selected = displayedItems[highlightedIndex];
        onChange(selected);
        onSelectSuggestion?.(selected);
        setIsOpen(false);
        setHighlightedIndex(-1);
      } else if (bestPrefixMatch) {
        e.preventDefault();
        onChange(bestPrefixMatch);
        onSelectSuggestion?.(bestPrefixMatch);
        setIsOpen(false);
      } else if (displayedItems.length > 0 && isOpen) {
        e.preventDefault();
        onChange(displayedItems[0]);
        onSelectSuggestion?.(displayedItems[0]);
        setIsOpen(false);
      }
    } else if (e.key === 'Tab' && bestPrefixMatch) {
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
        <div className="absolute inset-0 pointer-events-none flex items-center px-3 py-2 text-sm select-none overflow-hidden pr-8">
          <span className="opacity-0 whitespace-pre">{value}</span>
          <span className="text-slate-400/80 dark:text-slate-500 font-medium whitespace-pre">
            {ghostSuffix}
          </span>
          <span className="ml-auto text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
            ↵ Enter
          </span>
        </div>
      )}

      <div className="relative flex items-center w-full">
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
            setIsOpen(true);
          }}
          onClick={() => {
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full bg-transparent ${inputClassName}`}
        />
      </div>

      {/* Suggestion Dropdown - Matches Image 1 */}
      {isOpen && displayedItems.length > 0 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-h-60 overflow-y-auto py-1 divide-y divide-slate-100 dark:divide-slate-800/80">
          {displayedItems.map((item, idx) => {
            const isSelected =
              idx === highlightedIndex ||
              item.toLowerCase() === cleanVal;

            return (
              <button
                key={item + idx}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(item);
                }}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={`w-full px-4 py-3 text-left flex items-center justify-between cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-slate-100 dark:bg-slate-800/90 text-slate-900 dark:text-white font-semibold'
                    : 'text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <span className="text-sm font-medium truncate pr-4">
                  {item}
                </span>
                <span className="text-xs font-semibold text-slate-400 dark:text-slate-400 shrink-0">
                  Select
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
