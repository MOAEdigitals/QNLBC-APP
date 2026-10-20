import type { AppTab } from '../types';

/** A clean app URL opens Schedules; refresh retains any valid main-tab URL. */
export function initialAppTab(hash: string): AppTab {
  const tab = hash.replace(/^#/, '');
  return ['home', 'recognitions', 'special-numbers', 'songs', 'outlines', 'settings'].includes(tab)
    ? tab as AppTab
    : 'special-numbers';
}
