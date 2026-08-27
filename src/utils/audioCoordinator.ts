// Centralized Audio Coordinator to prevent conflicting playback and synchronize audio state across app tabs
type StopCallback = () => void;

interface ActiveAudioSession {
  id: string;
  audioElement: HTMLAudioElement | null;
  onStop?: StopCallback;
}

let currentActiveSession: ActiveAudioSession | null = null;

/**
 * Register an audio element as the currently active playing track.
 * Automatically stops any previously playing track across the entire app.
 */
export function registerActiveAudio(
  id: string,
  audioElement: HTMLAudioElement | null,
  onStop?: StopCallback
): void {
  if (currentActiveSession && currentActiveSession.id !== id) {
    try {
      if (currentActiveSession.audioElement) {
        currentActiveSession.audioElement.pause();
      }
    } catch (_) {}
    if (currentActiveSession.onStop) {
      try {
        currentActiveSession.onStop();
      } catch (_) {}
    }
  }

  currentActiveSession = {
    id,
    audioElement,
    onStop,
  };

  // Broadcast global event so any other players or UI indicators update
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('qnlbc_active_audio_change', {
        detail: { activeId: id },
      })
    );
  }
}

/**
 * Notify coordinator that a track has stopped or paused
 */
export function notifyAudioStopped(id: string): void {
  if (currentActiveSession && currentActiveSession.id === id) {
    currentActiveSession = null;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('qnlbc_active_audio_change', {
          detail: { activeId: null },
        })
      );
    }
  }
}

/**
 * Halt all currently active audio playing anywhere in the app
 */
export function stopAllActiveAudio(): void {
  if (currentActiveSession) {
    try {
      if (currentActiveSession.audioElement) {
        currentActiveSession.audioElement.pause();
      }
    } catch (_) {}
    if (currentActiveSession.onStop) {
      try {
        currentActiveSession.onStop();
      } catch (_) {}
    }
    currentActiveSession = null;
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('qnlbc_active_audio_change', {
        detail: { activeId: null },
      })
    );
  }
}

/**
 * Subscribe to active audio change events
 */
export function subscribeToActiveAudioChange(
  callback: (activeId: string | null) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const handler = (e: Event) => {
    const customEvent = e as CustomEvent<{ activeId: string | null }>;
    callback(customEvent.detail ? customEvent.detail.activeId : null);
  };

  window.addEventListener('qnlbc_active_audio_change', handler);
  return () => {
    window.removeEventListener('qnlbc_active_audio_change', handler);
  };
}
