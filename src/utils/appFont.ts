export const APP_FONTS = ['Inter', 'Plus Jakarta Sans', 'Roboto', 'Manrope'] as const;
export type AppFont = typeof APP_FONTS[number];
const FONT_KEY = 'qnlbc_app_font';

export function loadAppFont(): AppFont {
  try {
    const saved = localStorage.getItem(FONT_KEY);
    if (APP_FONTS.includes(saved as AppFont)) return saved as AppFont;
  } catch { /* Device storage may be unavailable. */ }
  return 'Plus Jakarta Sans';
}

export function applyAppFont(font: AppFont) {
  document.documentElement.style.setProperty('--font-sans', `"${font}", sans-serif`);
  try { localStorage.setItem(FONT_KEY, font); } catch { /* Apply for this session. */ }
}
