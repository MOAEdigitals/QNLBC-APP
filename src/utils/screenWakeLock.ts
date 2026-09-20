export interface ScreenLock {
  release(): Promise<void>;
  addEventListener(type: 'release', listener: () => void): void;
}

export type ScreenLockStatus = 'requesting' | 'active' | 'unavailable';

interface VisibilityPage {
  visibilityState: DocumentVisibilityState;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

// A request can resolve after a lyric view closes. Release that late lock too.
export function keepScreenAwake(
  request: () => Promise<ScreenLock>,
  page: VisibilityPage,
  report: (status: ScreenLockStatus) => void,
) {
  let stopped = false;
  let pending = false;
  let lock: ScreenLock | null = null;
  const acquire = async () => {
    if (stopped || pending || lock || page.visibilityState !== 'visible') return;
    pending = true;
    report('requesting');
    try {
      const next = await request();
      if (stopped || page.visibilityState !== 'visible') {
        await next.release();
        return;
      }
      lock = next;
      next.addEventListener('release', () => {
        if (lock === next) lock = null;
        if (!stopped) report('unavailable');
      });
      report('active');
    } catch {
      if (!stopped) report('unavailable');
    } finally {
      pending = false;
    }
  };
  const visibility = () => {
    if (page.visibilityState === 'visible') void acquire();
    else if (lock) {
      const previous = lock;
      lock = null;
      void previous.release().catch(() => {});
    }
  };
  page.addEventListener('visibilitychange', visibility);
  void acquire();
  return {
    retry: acquire,
    stop: () => {
      stopped = true;
      page.removeEventListener('visibilitychange', visibility);
      if (lock) void lock.release().catch(() => {});
      lock = null;
    },
  };
}
