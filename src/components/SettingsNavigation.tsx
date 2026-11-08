import React from 'react';
import { Bell, ChevronRight, Database, Megaphone, Palette, UserRound, Users } from 'lucide-react';

export function SettingsNavigation({ isAdmin, onSelect }: { isAdmin: boolean; onSelect: (section: string) => void }) {
  const personal = [
    { id: 'account', label: 'My Account', icon: UserRound },
    { id: 'appearance', label: 'Appearance', icon: Palette },
  ];
  const administration = [
    { id: 'members', label: 'People & Accounts', icon: Users },
    { id: 'announcements', label: 'Admin announcements', icon: Megaphone },
    { id: 'notificationSchedules', label: 'Notification schedules', icon: Bell },
    { id: 'data', label: 'Data management', icon: Database },
  ];
  return <nav aria-label="Settings sections" className="settings-navigation">
    {[{ label: 'Personal', items: personal }, ...(isAdmin ? [{ label: 'Church administration', items: administration }] : [])].map(group =>
      <section key={group.label} aria-label={group.label} className="settings-navigation-section">
        <h2 className="settings-group-heading">{group.label}</h2>
        <div className="settings-group-list">{group.items.map(({ id, label, icon: Icon }) =>
          <button key={id} type="button" className="settings-navigation-row" onClick={() => onSelect(id)}>
            <Icon className="settings-row-icon" aria-hidden="true" />
            <span>{label}</span><ChevronRight className="settings-row-chevron" aria-hidden="true" />
          </button>
        )}</div>
      </section>
    )}
  </nav>;
}
