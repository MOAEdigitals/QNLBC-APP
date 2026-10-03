// Predictable formatting cues; never rewrite the preacher's text.
const books = 'Genesis|Gen|Exodus|Exod|Ex|Leviticus|Lev|Numbers|Num|Deuteronomy|Deut|Joshua|Josh|Judges|Judg|Ruth|Samuel|Sam|Kings|Chronicles|Chr|Ezra|Nehemiah|Neh|Esther|Est|Job|Psalms?|Ps|Proverbs|Prov|Pr|Ecclesiastes|Eccl|Song of Solomon|Song of Songs|Isaiah|Isa|Jeremiah|Jer|Lamentations|Lam|Ezekiel|Ezek|Daniel|Dan|Hosea|Hos|Joel|Amos|Obadiah|Obad|Jonah|Micah|Mic|Nahum|Nah|Habakkuk|Hab|Zephaniah|Zeph|Haggai|Hag|Zechariah|Zech|Malachi|Mal|Matthew|Matt|Mark|Luke|John|Jn|Acts|Romans|Rom|Corinthians|Cor|Galatians|Gal|Ephesians|Eph|Philippians|Phil|Colossians|Col|Thessalonians|Thess|Timothy|Tim|Titus|Philemon|Phlm|Hebrews|Heb|James|Jas|Peter|Pet|Jude|Revelation|Rev';
export function bibleReferences(text: string): Array<{ from: number; to: number }> {
  const pattern = new RegExp(`\\b(?:[123]\\s+)?(?:${books})\\.?\\s+\\d{1,3}:\\d{1,3}(?:\\s*[–—-]\\s*(?:\\d{1,3}:)?\\d{1,3})?(?:\\s*,\\s*\\d{1,3}(?:\\s*[–—-]\\s*\\d{1,3})?)*`, 'gi');
  return Array.from(text.matchAll(pattern), match => ({ from: match.index!, to: match.index! + match[0].length }));
}
export function outlineLineStyle(text: string, first: boolean, inList: boolean): 'title' | 'point' | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const refs = bibleReferences(text);
  const onlyReferences = refs.length > 0 && text.replace(new RegExp(refs.map(({ from, to }) => text.slice(from, to).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g'), '').replace(/[\s;,\.]/g, '') === '';
  if (onlyReferences) return null;
  if (/^(introduction|intro|points?|conclusion|application|summary)\s*[:：]?\s*$/i.test(trimmed) || /^(introduction|intro|conclusion|application|summary)\s*[:：]/i.test(trimmed)) return 'point';
  if (/^(?:\d+[.)]|[IVX]+[.)]|[A-Z][.)])\s+/.test(trimmed) || inList) return 'point';
  // Limit title inference to a short standalone opening line.
  if (first && trimmed.length <= 120 && !/[.!?]$/.test(trimmed) && !refs.length) return 'title';
  return null;
}
