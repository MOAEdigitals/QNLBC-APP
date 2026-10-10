/** Remove only a matching standalone title immediately before an explicit first verse. */
export function cleanLeadingSongTitle(title: string, lyrics: string): string {
  const lines = lyrics.split(/\r?\n/);
  const first = lines.findIndex(line => line.trim().length > 0);
  if (first < 0) return lyrics;
  const normalize = (text: string) => text.trim().replace(/^#{1,6}\s+/, '').replace(/^title\s*:\s*/i, '').replace(/\s+/g, ' ').toLocaleLowerCase();
  if (normalize(lines[first]) !== normalize(title)) return lyrics;
  let verse = first + 1;
  while (verse < lines.length && !lines[verse].trim()) verse++;
  if (!/^\s*\[?verse\s*(?:1|one)\]?\s*[:.]?\s*$/i.test(lines[verse] || '')) return lyrics;
  return lines.slice(verse).join(lyrics.includes('\r\n') ? '\r\n' : '\n');
}
