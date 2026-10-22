export interface OrderedSetlistCard {
  id: string;
  date: string;
  displayOrder?: number;
  display_order?: number | null;
  createdAt?: string;
  revision?: number;
}

function position(item: OrderedSetlistCard): number {
  const order = item.displayOrder ?? item.display_order;
  return Number.isSafeInteger(order) && order! >= 0 ? order! : Number.MAX_SAFE_INTEGER;
}

/** Preserve date-group placement while applying the shared order within each date. */
export function orderSameDateSetlists<T extends OrderedSetlistCard>(items: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(item.date, [...(groups.get(item.date) || []), item]);
  for (const group of groups.values()) group.sort((a, b) => position(a) - position(b)
    || (a.createdAt || '').localeCompare(b.createdAt || '') || a.id.localeCompare(b.id));
  const offsets = new Map<string, number>();
  return items.map(item => {
    const offset = offsets.get(item.date) || 0;
    offsets.set(item.date, offset + 1);
    return groups.get(item.date)![offset];
  });
}

export function sameDateSetlistMove<T extends OrderedSetlistCard>(items: T[], sourceId: string, targetId: string, edge: 'before' | 'after') {
  const source = items.find(item => item.id === sourceId), target = items.find(item => item.id === targetId);
  if (!source || !target || source.date !== target.date) throw new Error('Only setlists with the same date can be reordered.');
  const group = orderSameDateSetlists(items.filter(item => item.date === source.date));
  const orderedIds = group.map(item => item.id);
  if (sourceId !== targetId) {
    orderedIds.splice(orderedIds.indexOf(sourceId), 1);
    orderedIds.splice(orderedIds.indexOf(targetId) + (edge === 'after' ? 1 : 0), 0, sourceId);
  }
  return { date: source.date, orderedIds, expectedRevisions: Object.fromEntries(group.map(item => [item.id, item.revision || 1])) };
}

/** The first card in the list: nearest upcoming, or most recent past as a fallback. */
export function featuredSetlistCardId(setlists: OrderedSetlistCard[], today: string): string | null {
  const sorted = [...setlists].sort((a, b) => {
    const aPast = a.date < today, bPast = b.date < today;
    if (aPast !== bPast) return aPast ? 1 : -1;
    return aPast ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date);
  });
  return orderSameDateSetlists(sorted)[0]?.id || null;
}

/** Choose a startup default once; a remembered empty list means the user closed it. */
export function initialSetlistCardId(
  setlists: OrderedSetlistCard[], today: string,
  requestedId?: string | null, rememberedIds?: readonly string[],
): string | null {
  if (requestedId) return requestedId;
  if (rememberedIds !== undefined) return rememberedIds.at(-1) || null;
  return featuredSetlistCardId(setlists, today);
}
