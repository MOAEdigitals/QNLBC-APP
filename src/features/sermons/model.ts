export interface SermonOutline {
  id: string;
  author_id: string;
  service_date: string;
  title: string;
  preacher: string;
  outline: string;
  status: 'draft' | 'published';
  revision: number;
  created_at: string;
  updated_at: string;
}
export type SermonInput = Pick<SermonOutline, 'service_date' | 'title' | 'preacher' | 'outline' | 'status'>;

export function sermonPayload(input: SermonInput): SermonInput {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.service_date) || !input.title.trim() || !input.preacher.trim() || !input.outline.trim()) {
    throw new Error('Please enter the service date, title, preacher, and outline.');
  }
  // Never trim, parse Markdown, or normalize the preacher's outline.
  return { ...input, title: input.title.trim(), preacher: input.preacher.trim(), outline: input.outline };
}
export function filterSermons(rows: SermonOutline[], filter: 'upcoming' | 'past', today: string, search: string): SermonOutline[] {
  const query = search.toLocaleLowerCase().trim();
  return rows.filter(row => (filter === 'past' ? row.service_date < today : row.service_date >= today)
    && (!query || `${row.title} ${row.preacher} ${row.outline}`.toLocaleLowerCase().includes(query)))
    .sort((a, b) => (filter === 'past' ? b.service_date.localeCompare(a.service_date) : a.service_date.localeCompare(b.service_date)) || a.title.localeCompare(b.title));
}
