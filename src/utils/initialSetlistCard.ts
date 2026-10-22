/** Choose a startup default once; a remembered empty list means the user closed it. */
export function initialSetlistCardId(
  setlists: Array<{ id: string; date: string }>, today: string,
  requestedId?: string | null, rememberedIds?: readonly string[],
): string | null {
  if (requestedId) return requestedId;
  if (rememberedIds !== undefined) return rememberedIds.at(-1) || null;
  return setlists.find(setlist => setlist.date === today)?.id || null;
}
