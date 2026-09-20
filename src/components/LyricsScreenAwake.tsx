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
  const { status, retry } = useLyricsScreenAwake(active);
  if (!active) return null;
  return <div role="status" className="lyrics-awake text-sm py-2">
    {status === 'active' ? 'Screen stays awake while lyrics are open.' : status === 'requesting'
      ? 'Keeping screen awake…'
      : <><span>Screen-awake protection unavailable. Your device may still sleep.</span>{' '}
        <button type="button" className="underline" onClick={retry}>Retry</button></>}
  </div>;
}
