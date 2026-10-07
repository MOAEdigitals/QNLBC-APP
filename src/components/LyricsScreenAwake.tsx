import React, { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { keepScreenAwake, type ScreenLockStatus } from '../utils/screenWakeLock';

const requestScreenLock = async () => {
  if (Capacitor.isNativePlatform()) {
    await KeepAwake.keepAwake();
    return {
      release: async () => { await KeepAwake.allowSleep(); },
      addEventListener: () => {},
    };
  }
  if (!navigator.wakeLock) throw new Error('Screen wake lock is unavailable');
  return navigator.wakeLock.request('screen');
};

export function useLyricsScreenAwake(active: boolean) {
  const [status, setStatus] = useState<ScreenLockStatus>('requesting');
  const controller = useRef<ReturnType<typeof keepScreenAwake> | null>(null);
  useEffect(() => {
    if (!active) return;
    controller.current = keepScreenAwake(
      requestScreenLock,
      document,
      setStatus,
    );
    return () => { controller.current?.stop(); controller.current = null; };
  }, [active]);
  return { status, retry: () => void controller.current?.retry() };
}

export function LyricsScreenAwake({ active }: { active: boolean }) {
  useLyricsScreenAwake(active);
  return null;
}
