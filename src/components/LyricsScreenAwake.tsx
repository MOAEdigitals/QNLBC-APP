import React, { useEffect, useRef, useState } from 'react';
import { keepScreenAwake, type ScreenLockStatus } from '../utils/screenWakeLock';

export function useLyricsScreenAwake(active: boolean) {
  const [status, setStatus] = useState<ScreenLockStatus>('requesting');
  const controller = useRef<ReturnType<typeof keepScreenAwake> | null>(null);
  useEffect(() => {
    if (!active) return;
    controller.current = keepScreenAwake(
      () => navigator.wakeLock ? navigator.wakeLock.request('screen') : Promise.reject(),
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
