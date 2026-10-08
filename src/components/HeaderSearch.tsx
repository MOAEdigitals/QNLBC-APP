import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

export interface HeaderSearchConfig {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  beforeSearch?: React.ReactNode;
}

interface HeaderSearchContextValue {
  search: HeaderSearchConfig | null;
  register: (key: symbol, config: HeaderSearchConfig | null) => void;
}

const HeaderSearchContext = createContext<HeaderSearchContextValue | null>(null);

export function useHeaderSearchContext() {
  const context = useContext(HeaderSearchContext);
  if (!context) throw new Error('Header search must be used within HeaderSearchProvider.');
  return context;
}

export function HeaderSearchProvider({ children }: { children: React.ReactNode }) {
  const registrations = useRef(new Map<symbol, HeaderSearchConfig>());
  const [search, setSearch] = useState<HeaderSearchConfig | null>(null);
  const register = useCallback((key: symbol, config: HeaderSearchConfig | null) => {
    if (config) registrations.current.set(key, config);
    else registrations.current.delete(key);
    const values = [...registrations.current.values()];
    setSearch(values.at(-1) || null);
  }, []);
  const value = useMemo(() => ({ search, register }), [search, register]);
  return <HeaderSearchContext.Provider value={value}>{children}</HeaderSearchContext.Provider>;
}

export function useHeaderSearch(config: HeaderSearchConfig | null) {
  const context = useContext(HeaderSearchContext);
  const register = context?.register;
  const key = useRef(Symbol('header-search'));
  useEffect(() => {
    if (!register) return;
    register(key.current, config);
  }, [register, config?.value, config?.onChange, config?.placeholder, config?.label, config?.beforeSearch]);
  useEffect(() => () => register?.(key.current, null), [register]);
}
