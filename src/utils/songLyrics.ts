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
const sectionHeading = /^\s*(?:#{1,6}\s+)?\[?(verse|chorus|pre[- ]?chorus|bridge|refrain|intro|outro|ending|tag|coda|interlude)(?:\s+(?:\d+[a-z]?|[a-z]|one|two|three|four))?\]?(?:\s*\([^\r\n)]+\))?\s*[:.]?\s*$/i;

/** Drop empty section headings without changing any lyric lines. */
export function cleanEmptySectionLabels(lyrics: string): string {
  const lines = lyrics.split(/\r?\n/);
  const section = sectionHeading;
  const removed = new Set<number>();
  for (let i = 0; i < lines.length; i++) {
    if (!section.test(lines[i])) continue;
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

/** Keep one written copy of each chorus; preserve distinct lyrics and other sections. */
export function cleanDuplicateChorusSections(lyrics: string): string {
  const lines = lyrics.split(/\r?\n/);
  const headings = lines.flatMap((line, index) => {
    const match = sectionHeading.exec(line);
    return match ? [{ index, kind: match[1].toLowerCase() }] : [];
  });
  const seen = new Map<string, number>();
  const removed = new Set<number>();
  let changed = false;
  for (let i = 0; i < headings.length; i++) {
    const { index, kind } = headings[i];
    if (kind !== 'chorus') continue;
    const end = headings[i + 1]?.index ?? lines.length;
    const key = lines.slice(index + 1, end).join('\n').normalize('NFKC')
      .replace(/[’‘′ʼ`´]/g, "'").toLowerCase().replace(/[^\p{L}\p{N}']+/gu, ' ').trim();
    if (!key) continue;
    if (seen.has(key)) {
      for (let line = index; line < end; line++) removed.add(line);
      changed = true;
    } else {
      const number = seen.size + 1;
      seen.set(key, number);
      const label = number === 1 ? 'CHORUS' : `CHORUS ${number}`;
      if (lines[index] !== label) { lines[index] = label; changed = true; }
    }
  }
  if (!changed) return lyrics;
  return lines.filter((_, index) => !removed.has(index)).join(lyrics.includes('\r\n') ? '\r\n' : '\n').trimEnd();
}
