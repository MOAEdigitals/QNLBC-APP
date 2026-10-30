let audio: AudioContext | undefined;
let lastPlayed = 0;
export const notificationSoundEnabled = (userId: string) => { try { return localStorage.getItem(`qnlbc_notification_sound:${userId}`) !== 'off'; } catch { return true; } };
export function setNotificationSoundEnabled(userId: string, enabled: boolean) { try { localStorage.setItem(`qnlbc_notification_sound:${userId}`, enabled ? 'on' : 'off'); } catch { /* session still works without storage */ } }
export async function unlockNotificationSound() {
  try {
    const Context = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    if (!audio || audio.state === 'closed') audio = new Context();
    if (audio.state === 'suspended') await audio.resume();
  } catch { /* Browser audio permission is controlled by the user. */ }
}
export async function playNotificationSound(userId: string, test = false): Promise<boolean> {
  if (!notificationSoundEnabled(userId) || (!test && document.visibilityState !== 'visible')) return false;
  if (test) await unlockNotificationSound();
  if (!audio || audio.state !== 'running' || (!test && Date.now() - lastPlayed < 1500)) return false;
  lastPlayed = Date.now();
  const start = audio.currentTime;
  [659.25, 880].forEach((frequency, index) => {
    const oscillator = audio!.createOscillator(), gain = audio!.createGain();
    oscillator.type = 'sine'; oscillator.frequency.value = frequency;
    const time = start + index * 0.19;
    gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(0.12, time + 0.015); gain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);
    oscillator.connect(gain); gain.connect(audio!.destination);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(time); oscillator.stop(time + 0.36);
  });
  return true;
}

export function hasNewUnreadNotifications(rows: Array<{ id: string; read_at: string | null; created_at: string }>, seen: Set<string> | null, startedAt: number): boolean {
  return Boolean(seen && rows.some(row => !row.read_at && !seen.has(row.id) && Date.parse(row.created_at) >= startedAt));
}
