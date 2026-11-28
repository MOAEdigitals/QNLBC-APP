import { Capacitor } from '@capacitor/core';

type Area = 'vocal-part-save' | 'audio-playback' | 'offline-download' | 'data-refresh';
const events: { area: Area; code: string; at: string }[] = [];
export function recordDiagnostic(area: Area, error: unknown) {
  const value = error as { code?: unknown; name?: unknown } | null;
  const raw = String(value?.code ?? value?.name ?? 'UNKNOWN');
  // Never retain messages, URLs, lyrics, names, tokens, or request payloads.
  const code = /^(?:[A-Z][A-Z0-9_]{0,39}|[0-9]{1,5}|[A-Za-z]{1,35}Error)$/.test(raw) ? raw : 'UNKNOWN';
  events.push({ area, code, at: new Date().toISOString() });
  if (events.length > 12) events.shift();
}
export function diagnosticText(info: { platform: string; version?: string; build?: string; userAgent: string; online: boolean }) {
  return ['QNLBC diagnostics', `Platform: ${info.platform}`, `Version: ${info.version || 'Web'}`, `Build: ${info.build || 'unknown'}`,
    `Online: ${info.online ? 'yes' : 'no'}`, `Browser/WebView: ${info.userAgent}`, `Collected: ${new Date().toISOString()}`,
    'Recent error codes (this session):', ...events.map(event => `${event.at} | ${event.area} | ${event.code}`),
    ...(events.length ? [] : ['None recorded'])].join('\n');
}
export async function collectDiagnostics() {
  let version: string | undefined;
  if (Capacitor.isNativePlatform()) {
    const { App } = await import('@capacitor/app');
    version = (await App.getInfo().catch(() => null))?.version;
  }
  return diagnosticText({ platform: Capacitor.getPlatform(), version, build: import.meta.env.VITE_APP_BUILD,
    userAgent: navigator.userAgent, online: navigator.onLine });
}
