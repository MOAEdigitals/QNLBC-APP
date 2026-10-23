/** Theme-aware ink derived from the original hue; source text and rich marks stay intact. */
function rgb(color: string): number[] | null {
  const names: Record<string, string> = { black: '#000000', white: '#ffffff', blue: '#0000ff', red: '#ff0000', green: '#008000', yellow: '#ffff00', gray: '#808080', grey: '#808080', purple: '#800080', navy: '#000080' };
  const value = names[color.toLowerCase().trim()] || color.trim();
  const hex = /^#([a-f\d]{3}|[a-f\d]{6})$/i.exec(value)?.[1];
  if (hex) { const full = hex.length === 3 ? [...hex].map(c => c + c).join('') : hex; return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16)); }
  const match = /^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)/i.exec(value);
  return match ? match.slice(1, 4).map(n => Math.min(255, Number(n))) : null;
}
function luminance(channels: number[]) {
  return channels.map(n => { const c = n / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
}
function readable(channels: number[], background: number[], lighten: boolean): string {
  const bg = luminance(background);
  let result = channels;
  for (let amount = 0; amount <= 100; amount++) {
    result = channels.map(n => Math.round(n + ((lighten ? 255 : 0) - n) * amount / 100));
    const ink = luminance(result);
    if ((Math.max(ink, bg) + .05) / (Math.min(ink, bg) + .05) >= (lighten ? 7 : 4.5)) break;
  }
  return `rgb(${result.join(', ')})`;
}
export function outlineInk(color: string): { neutral: boolean; light: string; dark: string } | null {
  const channels = rgb(color);
  if (!channels) return null;
  return { neutral: Math.max(...channels) - Math.min(...channels) < 24, light: readable(channels, [255, 255, 255], false), dark: readable(channels, [15, 23, 42], true) };
}
export function outlineInkAttributes(color?: string | null, backgroundColor?: string | null): Record<string, string> {
  const ink = color && outlineInk(color);
  const attributes: Record<string, string> = {};
  const styles: string[] = [];
  if (ink) {
    attributes['data-outline-ink'] = '';
    styles.push(ink.neutral ? '--outline-light-ink: inherit; --outline-dark-ink: inherit' : `--outline-light-ink: ${ink.light}; --outline-dark-ink: ${ink.dark}`);
  }
  const background = backgroundColor && rgb(backgroundColor);
  if (background && Math.max(...background) - Math.min(...background) >= 24) {
    attributes['data-outline-highlight'] = '';
    // A highlight is a fixed surface: use its actual background, independent of app theme.
    const darkContrast = (luminance(background) + .05) / .05;
    const lightContrast = 1.05 / (luminance(background) + .05);
    styles.push(`--outline-highlight-ink: ${darkContrast >= lightContrast ? '#0f172a' : '#ffffff'}`);
  }
  if (styles.length) attributes.style = styles.join('; ');
  return attributes;
}
