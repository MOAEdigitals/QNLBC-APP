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
    let previousHeight = 0;
    const measure = () => {
      const height = Math.ceil(nav.getBoundingClientRect().height);
      if (height <= 0 || height === previousHeight) return;
      previousHeight = height;
      document.documentElement.style.setProperty('--app-bottom-nav-height', `${height}px`);
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
      <div className="app-tab-bar max-w-4xl mx-auto flex items-center justify-around px-0 sm:px-2 py-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              type="button"
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className="app-tab-item"
            >
              <span className="app-tab-icon" aria-hidden="true"><Icon className="w-5 h-5" /></span>
              <span className="app-nav-label">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
