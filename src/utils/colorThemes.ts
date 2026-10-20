export const COLOR_THEMES = [
  { id: 'default', name: 'Corporate (Default)', base: '#44749D', accent: '#C6D4E1', swatches: ['#BDB8AD','#EBE7E0','#C6D4E1','#44749D'] },
  { id: 'zesty', name: 'Zesty', base: '#0F2080', accent: '#85C0F9', swatches: ['#F5793A','#A95AA1','#85C0F9','#0F2080'] },
  { id: 'elegant', name: 'Elegant', base: '#382119', accent: '#ABC3C9', swatches: ['#ABC3C9','#E0DCD3','#CCBE9F','#382119'] },
  { id: 'retro', name: 'Retro', base: '#601A4A', accent: '#63ACBE', swatches: ['#601A4A','#EE442F','#63ACBE','#F9F4EC'] },
] as const;
// Remap chromatic UI utilities only. Slate, white and black remain the normal
// Light/Dark surfaces; the same palette-derived scales serve icons and cards.
export const THEME_HUES = ['red','orange','amber','yellow','lime','green','emerald','teal','cyan','sky','blue','indigo','violet','purple','fuchsia','pink','rose'];
export const THEME_LEVELS = [50,100,200,300,400,500,600,700,800,900,950];
export function mixThemeColor(first: string, second: string, amount: number): string {
  const rgb = (hex: string) => hex.slice(1).match(/../g)!.map(value => parseInt(value,16));
  const a=rgb(first), b=rgb(second);
  return '#' + a.map((value,index)=>Math.round(value*amount+b[index]*(1-amount)).toString(16).padStart(2,'0')).join('');
}
export function themeContrast(first: string, second: string): number {
  const luminance = (hex: string) => {
    const rgb=hex.slice(1).match(/../g)!.map(value=>parseInt(value,16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);
    return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
  };
  const a=luminance(first),b=luminance(second);
  return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}
function readableColor(seed: string, background: string, target: string, minimum: number): string {
  let color=seed;
  for(let step=0;step<=100 && themeContrast(color,background)<minimum;step++) color=mixThemeColor(seed,target,1-step/100);
  return color;
}
export function paletteScale(seed: string): Record<number,string> {
  return {
    50: mixThemeColor(seed,'#ffffff',.04),
    100: mixThemeColor(seed,'#ffffff',.10),
    200: mixThemeColor(seed,'#ffffff',.22),
    300: readableColor(mixThemeColor(seed,'#ffffff',.48),'#0f172a','#ffffff',7),
    400: readableColor(mixThemeColor(seed,'#ffffff',.70),'#0f172a','#ffffff',5),
    500: readableColor(seed,'#ffffff','#000000',4.7),
    600: readableColor(seed,'#ffffff','#000000',5.8),
    700: readableColor(seed,'#ffffff','#000000',7),
    800: readableColor(seed,'#ffffff','#000000',9),
    900: mixThemeColor(seed,'#0f172a',.12),
    950: mixThemeColor(seed,'#020617',.06),
  };
}
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
  THEME_HUES.forEach((hue,index)=>{
    // Additional categories use nearby mixtures from the same four swatches.
    const primary=theme.swatches[index % theme.swatches.length];
    const neighbor=theme.swatches[(index+1) % theme.swatches.length];
    const seed=mixThemeColor(primary,neighbor,1-Math.floor(index/4)*.08);
    const scale=paletteScale(seed);
    THEME_LEVELS.forEach(level=>root.style.setProperty(`--color-${hue}-${level}`,scale[level]));
  });
  const foreground = mode === 'dark' ? theme.accent : theme.base;
  root.style.setProperty('--ui-accent', foreground);
  root.style.setProperty('--theme-button', foreground);
  root.style.setProperty('--theme-button-text', mode === 'dark' ? '#0f172a' : '#ffffff');
  root.style.setProperty('--theme-highlight', `color-mix(in srgb, ${mode === 'dark' ? theme.accent : theme.base} 12%, ${mode === 'dark' ? '#0f172a' : '#ffffff'})`);
  try { localStorage.setItem('qnlbc_color_theme', theme.id); } catch {}
}
