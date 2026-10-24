import React, { useLayoutEffect, useRef } from 'react';
import { AppTab } from '../types';
import { CalendarDays, Award, Music, FileText } from 'lucide-react';

interface BottomNavProps {
  activeTab: AppTab;
  onChangeTab: (tab: AppTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
}) => {
  const navRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const measure = () => {
      const height = nav.getBoundingClientRect().height;
      if (height > 0) document.documentElement.style.setProperty('--app-bottom-nav-height', `${height}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    return () => observer.disconnect();
  }, []);
  const tabs = [
    {
      id: 'home' as AppTab,
      label: 'Setlists',
      sublabel: 'Order of Service',
      icon: CalendarDays,
    },
    {
      id: 'recognitions' as AppTab,
      label: 'Recognitions',
      sublabel: 'Celebrants',
      icon: Award,
    },
    {
      id: 'special-numbers' as AppTab,
      label: 'Schedules',
      sublabel: 'Songs, Outlines & Activities',
      icon: CalendarDays,
    },
    {
      id: 'songs' as AppTab,
      label: 'Songs',
      sublabel: 'Library',
      icon: Music,
    },
    { id: 'outlines' as AppTab, label: 'Outlines', sublabel: 'Sermons', icon: FileText },
  ];

  return (
    <nav
      ref={navRef}
      aria-label="Main navigation"
      className="app-bottom-nav fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-950 pb-[var(--app-safe-bottom)] no-print"
    >
      <div className="max-w-4xl mx-auto flex items-center justify-around px-0 sm:px-2 py-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex-1 min-w-0 h-14 flex flex-col items-center justify-center py-1 px-0 rounded-xl transition-colors relative ${
                isActive
                  ? 'text-slate-950 dark:text-white font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <div>
                <div
                  className={`p-1.5 rounded-lg transition-transform ${
                    isActive ? 'scale-110 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' : ''
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <span className="app-nav-label w-full leading-tight mt-0.5 text-center whitespace-nowrap">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
