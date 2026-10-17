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
/** Drop chorus headings whose section contains no lyrics. */
export function cleanEmptyChorusLabels(lyrics: string): string {
  const lines = lyrics.split(/\r?\n/);
  const chorus = /^\s*(?:#{1,6}\s+)?\[?chorus\s*\d*\]?\s*[:.]?\s*$/i;
  const section = /^\s*(?:#{1,6}\s+)?\[?(?:(?:verse|chorus|pre[- ]?chorus|bridge|refrain|intro|outro|ending|tag|coda|interlude)(?:\s+(?:\d+|one|two|three|four))?)\]?\s*[:.]?\s*$/i;
  const removed = new Set<number>();
  for (let i = 0; i < lines.length; i++) {
    if (!chorus.test(lines[i])) continue;
    let next = i + 1;
    while (next < lines.length && !lines[next].trim()) next++;
    if (next === lines.length || section.test(lines[next])) {
      removed.add(i);
      // Remove the empty section's spacing, keeping the preceding section break.
      for (let blank = i + 1; blank < next; blank++) removed.add(blank);
    }
  }
  if (!removed.size) return lyrics;
  return lines.filter((_, index) => !removed.has(index)).join(lyrics.includes('\r\n') ? '\r\n' : '\n').trimEnd();
}
