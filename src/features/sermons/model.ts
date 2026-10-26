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
function searchText(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}
function sermonBody(row: SermonOutline): string {
  return row.outline.trim() ? row.outline : (row.outline_html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&#(\d+);/g, (_, value) => String.fromCodePoint(Math.min(Number(value), 0x10ffff)));
}
/** Short, readable context around a body match; rendered as text, never as HTML. */
export function sermonSearchSnippet(row: SermonOutline, search: string): { before: string; match: string; after: string } | null {
  const query = searchText(search);
  if (!query) return null;
  const body = sermonBody(row).normalize('NFKC').replace(/\s+/g, ' ').trim();
  const index = body.toLocaleLowerCase().indexOf(query);
  if (index < 0) return null;
  let start = Math.max(0, index - 60), end = Math.min(body.length, index + query.length + 95);
  // Prefer whole words when an excerpt starts or ends mid-sentence.
  if (start > 0) { const space = body.indexOf(' ', start); if (space < index && space >= 0) start = space + 1; }
  if (end < body.length) { const space = body.lastIndexOf(' ', end); if (space > index + query.length) end = space; }
  return { before: `${start > 0 ? '…' : ''}${body.slice(start, index)}`, match: body.slice(index, index + query.length), after: `${body.slice(index + query.length, end)}${end < body.length ? '…' : ''}` };
}
/** Prefer title/preacher matches, then search the preaching's editable text. */
export function sermonSearchRank(row: SermonOutline, search: string): number {
  const query = searchText(search);
  if (!query) return 0;
  if (searchText(`${row.title} ${row.preacher}`).includes(query)) return 0;
  return searchText(sermonBody(row)).includes(query) ? 1 : -1;
}
export function filterSermons(rows: SermonOutline[], filter: 'upcoming' | 'past', today: string, search: string): SermonOutline[] {
  return rows.filter(row => (filter === 'past' ? row.service_date < today : row.service_date >= today)
    && sermonSearchRank(row, search) >= 0)
    .sort((a, b) => sermonSearchRank(a, search) - sermonSearchRank(b, search) || (filter === 'past' ? b.service_date.localeCompare(a.service_date) : a.service_date.localeCompare(b.service_date)) || a.title.localeCompare(b.title));
}

export function listSermons(rows: SermonOutline[], today: string, search: string): SermonOutline[] {
  return rows.filter(row => sermonSearchRank(row, search) >= 0)
    .sort((a, b) => {
      const rank = sermonSearchRank(a, search) - sermonSearchRank(b, search);
      if (rank) return rank;
      const aPast = a.service_date < today;
      const bPast = b.service_date < today;
      if (aPast !== bPast) return aPast ? 1 : -1;
      return (aPast ? b.service_date.localeCompare(a.service_date) : a.service_date.localeCompare(b.service_date)) || a.title.localeCompare(b.title);
    });
}

/** The church's own outline collection starts in 2026; future years stay in it. */
export function groupSermonArchive(rows: SermonOutline[], today: string, search: string): { current: SermonOutline[]; archive: SermonOutline[] } {
  const visible = listSermons(rows, today, search);
  return {
    current: visible.filter(row => row.service_date >= '2026-01-01'),
    archive: visible.filter(row => row.service_date < '2026-01-01'),
  };
}
