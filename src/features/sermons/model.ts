export interface SermonAttachment {
  id: string;
  name: string;
  kind: 'pdf' | 'docx';
  path: string;
  size: number;
}
export interface SermonOutline {
  id: string;
  author_id: string;
  service_date: string;
  title: string;
  preacher: string;
  outline: string;
  status: 'draft' | 'published';
  outline_html?: string | null;
  attachments?: SermonAttachment[];
  is_done?: boolean;
  revision: number;
  created_at: string;
  updated_at: string;
}
export type SermonInput = Pick<SermonOutline, 'service_date' | 'title' | 'preacher' | 'outline' | 'status' | 'outline_html' | 'attachments' | 'is_done'>;

export function sermonPayload(input: SermonInput): SermonInput {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.service_date) || !input.title.trim() || !input.preacher.trim() || (!input.outline.trim() && !(input.attachments?.length))) {
    throw new Error('Please enter the service date, title, preacher, and an outline or attachment.');
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

export function listSermons(rows: SermonOutline[], today: string, search: string): SermonOutline[] {
  const query = search.toLocaleLowerCase().trim();
  return rows.filter(row => !query || `${row.title} ${row.preacher} ${row.outline}`.toLocaleLowerCase().includes(query))
    .sort((a, b) => {
      const aPast = a.service_date < today || !!a.is_done;
      const bPast = b.service_date < today || !!b.is_done;
      if (aPast !== bPast) return aPast ? 1 : -1;
      return (aPast ? b.service_date.localeCompare(a.service_date) : a.service_date.localeCompare(b.service_date)) || a.title.localeCompare(b.title);
    });
}
