export type SwipeTab = 'home' | 'recognitions' | 'special-numbers' | 'songs' | 'outlines';
export const swipeTabs: SwipeTab[] = ['home', 'recognitions', 'special-numbers', 'songs', 'outlines'];
export const swipeSubtabs: Partial<Record<SwipeTab, string[]>> = { recognitions: ['birthdays', 'special', 'anniversaries'], 'special-numbers': ['activities', 'schedules', 'choir', 'practice'] };
export function swipeDestination(tab: string, subtab: string | undefined, direction: 1 | -1): { tab: SwipeTab; subtab?: string } | null {
  const index = swipeTabs.indexOf(tab as SwipeTab);
  if (index < 0) return null;
  const subs = swipeSubtabs[tab as SwipeTab];
  const subIndex = subs ? Math.max(0, subs.indexOf(subtab || subs[0])) : 0;
  if (subs?.[subIndex + direction]) return { tab: tab as SwipeTab, subtab: subs[subIndex + direction] };
  const next = swipeTabs[index + direction];
  if (!next) return null;
  const targetSubs = swipeSubtabs[next];
  return { tab: next, subtab: targetSubs?.[direction === 1 ? 0 : targetSubs.length - 1] };
}
export function swipeDirection(startX: number, startY: number, endX: number, endY: number, width: number, duration: number): 1 | -1 | null {
  if (startX <= 32 || startX >= width - 32 || duration > 900) return null;
  const dx = endX - startX, dy = endY - startY;
  if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.6) return null;
  return dx < 0 ? 1 : -1;
}
