export const COLOR_THEMES = [
  { id: 'default', name: 'Default', base: '#0f172a', accent: '#93c5fd' },
  { id: 'prompt', name: 'Prompt Blue / AI Green', base: '#0B132B', accent: '#39FF88' },
  { id: 'blueberry', name: 'Blueberry / Cream Soda', base: '#283D87', accent: '#FFF1C7' },
  { id: 'raspberry', name: 'Raspberry / Pale Sky', base: '#BD0C51', accent: '#E0F2FF' },
  { id: 'teal', name: 'Cyber Teal / Aqua Foam', base: '#003B41', accent: '#91F9DF' },
  { id: 'clay', name: 'Clay Brown / Soft Butter', base: '#6B352A', accent: '#FFF1A6' },
  { id: 'forest', name: 'Forest Graphite / Acid Mint', base: '#18251D', accent: '#B7FF72' },
  { id: 'inkberry', name: 'Inkberry / Peach', base: '#1A0B2E', accent: '#FFB7A5' },
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
  if (theme.id !== 'default') {
    root.dataset.colorTheme = theme.id;
    const foreground = mode === 'dark' ? theme.accent : theme.base;
    root.style.setProperty('--ui-accent', foreground);
    root.style.setProperty('--theme-button', foreground);
    root.style.setProperty('--theme-button-text', mode === 'dark' ? theme.base : '#ffffff');
    root.style.setProperty('--theme-highlight', `color-mix(in srgb, ${mode === 'dark' ? theme.accent : theme.base} 12%, ${mode === 'dark' ? '#0f172a' : '#ffffff'})`);
  }
  try { localStorage.setItem('qnlbc_color_theme', theme.id); } catch {}
}
