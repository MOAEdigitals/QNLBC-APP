/** Change only section-label formatting; never deduplicate or expand lyric sections. */
function sectionLabel(line: string): string | null {
  const visible = line.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  const label = visible.replace(/^#{1,6}\s+/, '').replace(/[:.]$/, '').replace(/^\[(.*)\]$/, '$1').replace(/[:.]$/, '').trim();
  if (!/^(?:verse|chorus|pre[- ]?chorus|post[- ]?chorus|bridge|refrain|intro|outro|ending|tag|coda|vamp|interlude|instrumental|solo)(?:\s*(?:\d+[a-z]?|[ivx]+|one|two|three|four|five|six))?(?:\s*\([^()]*\))?$/i.test(label)) return null;
  return label[0].toUpperCase() + label.slice(1).toLowerCase();
}

export function formatFreeShowLyrics(title: string, lyrics: string): string {
  const lines = lyrics.replace(/\r\n?/g, '\n').split('\n');
  const first = lines.findIndex(line => line.trim());
  const sameTitle = (line: string) => line.trim().normalize('NFC').toLocaleLowerCase() === title.trim().normalize('NFC').toLocaleLowerCase();
  let body = lines;
  if (first >= 0) {
    const header = lines[first].replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    if (/^\[title\]$/i.test(header)) {
      const next = lines.findIndex((line, i) => i > first && line.trim());
      if (next >= 0 && sameTitle(lines[next])) body = lines.slice(next + 1);
    } else if (sameTitle(lines[first])) {
      const next = lines.findIndex((line, i) => i > first && line.trim());
      // Reuse an existing title heading, but keep a matching sung first line.
      if (next >= 0 && sectionLabel(lines[next])) body = lines.slice(first + 1);
    }
  }
  const formatted = body.map(line => {
    const label = sectionLabel(line);
    return label ? `[${label}]` : line;
  }).join('\n');
  // Normalize only the boundary between title metadata and the original body.
  return `[Title]\n${title}${formatted.trim() ? '\n\n' + formatted.replace(/^\n+/, '') : '\n'}`;
}
