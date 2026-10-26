/** Title Case every word, preserving apostrophes within contractions. */
export function songTitleCase(title: string): string {
  return title.trim().replace(/\p{L}[\p{L}\p{M}]*(?:['’][\p{L}\p{M}]+)*/gu, word => {
    if (/^[IVXLCDM]{2,}$/.test(word) || ['QNLBC', 'IBMA'].includes(word.toUpperCase())) return word.toUpperCase();
    return word[0].toLocaleUpperCase() + word.slice(1).toLocaleLowerCase();
  });
}
