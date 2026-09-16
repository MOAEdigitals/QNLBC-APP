import React from 'react';
import { AppTab } from '../types';
import { CalendarDays, Award, Mic2, Music, Settings } from 'lucide-react';

interface BottomNavProps {
  activeTab: AppTab;
  onChangeTab: (tab: AppTab) => void;
  celebrantCount?: number;
  upcomingSpecialCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  celebrantCount = 0,
  upcomingSpecialCount = 0,
}) => {
  const tabs = [
    {
      id: 'home' as AppTab,
      label: 'Setlists',
      sublabel: 'Order of Service',
      icon: CalendarDays,
      badge: 0,
    },
    {
      id: 'recognitions' as AppTab,
      label: 'Recognitions',
      sublabel: 'Celebrants',
      icon: Award,
      badge: celebrantCount,
    },
    {
      id: 'special-numbers' as AppTab,
      label: 'Song Numbers',
      sublabel: 'Schedule & Practice',
      icon: Mic2,
      badge: upcomingSpecialCount,
    },
    {
      id: 'songs' as AppTab,
      label: 'Songs',
      sublabel: 'Library',
      icon: Music,
      badge: 0,
    },
    {
      id: 'settings' as AppTab,
      label: 'Settings',
      sublabel: 'Admin & Theme',
      icon: Settings,
      badge: 0,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-[env(safe-area-inset-bottom)] no-print transition-colors">
      <div className="max-w-4xl mx-auto flex items-center justify-around px-2 py-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all relative ${
                isActive
                  ? 'text-slate-950 dark:text-white font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <div
                  className={`p-1.5 rounded-lg transition-transform ${
                    isActive ? 'scale-110 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' : ''
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                {tab.badge > 0 && (
                  <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] leading-tight mt-0.5 tracking-tight truncate max-w-[70px]">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
