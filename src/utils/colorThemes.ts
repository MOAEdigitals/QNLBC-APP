export const COLOR_THEMES = [
  { id: 'default', name: 'Corporate (Default)', base: '#44749D', accent: '#C6D4E1', swatches: ['#BDB8AD','#EBE7E0','#C6D4E1','#44749D'] },
  { id: 'zesty', name: 'Zesty', base: '#0F2080', accent: '#85C0F9', swatches: ['#F5793A','#A95AA1','#85C0F9','#0F2080'] },
  { id: 'elegant', name: 'Elegant', base: '#382119', accent: '#ABC3C9', swatches: ['#ABC3C9','#E0DCD3','#CCBE9F','#382119'] },
  { id: 'retro', name: 'Retro', base: '#601A4A', accent: '#63ACBE', swatches: ['#601A4A','#EE442F','#63ACBE','#F9F4EC'] },
] as const;
export type ColorTheme = typeof COLOR_THEMES[number]['id'];
export function loadColorTheme(): ColorTheme {
  try {
    const saved = localStorage.getItem('qnlbc_color_theme');
    return COLOR_THEMES.find(theme => theme.id === saved)?.id || 'default';
  } catch { return 'default'; }
}
export function applyColorTheme(root: HTMLElement, id: ColorTheme, mode: 'light' | 'dark') {
  const theme = COLOR_THEMES.find(theme => theme.id === id) || COLOR_THEMES[0];
  const properties = ['--ui-accent', '--ui-border', '--ui-surface', '--theme-page', '--theme-button', '--theme-button-text', '--theme-highlight',
    ...[50,100,200,300,400,500,600,700,800,900,950].map(step => `--color-slate-${step}`),
    ...['blue', 'indigo'].flatMap(color => [50,100,200,300,400,500,600,700,800,900,950].map(step => `--color-${color}-${step}`))];
  properties.forEach(property => root.style.removeProperty(property));
  delete root.dataset.colorTheme;
  root.dataset.colorTheme = theme.id;
  const foreground = mode === 'dark' ? theme.accent : theme.base;
  root.style.setProperty('--ui-accent', foreground);
  root.style.setProperty('--theme-button', foreground);
  root.style.setProperty('--theme-button-text', mode === 'dark' ? '#0f172a' : '#ffffff');
  root.style.setProperty('--theme-highlight', `color-mix(in srgb, ${mode === 'dark' ? theme.accent : theme.base} 12%, ${mode === 'dark' ? '#0f172a' : '#ffffff'})`);
  try { localStorage.setItem('qnlbc_color_theme', theme.id); } catch {}
}
