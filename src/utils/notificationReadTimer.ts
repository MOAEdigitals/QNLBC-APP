/** Each notification needs five uninterrupted seconds in the visible inbox. */
export function createNotificationReadTimer(onRead: (ids: string[]) => void, clock = {
  now: () => Date.now(),
  later: (fn: () => void, delay: number) => setTimeout(fn, delay),
  cancel: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
}) {
  const deadlines = new Map<string, number>();
  const attempted = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    if (timer !== undefined) clock.cancel(timer);
    timer = undefined;
    if (!deadlines.size) return;
    timer = clock.later(() => {
      timer = undefined;
      const due = [...deadlines].filter(([, time]) => time <= clock.now()).map(([id]) => id);
      due.forEach(id => { deadlines.delete(id); attempted.add(id); });
      if (due.length) onRead(due);
      schedule();
    }, Math.max(0, Math.min(...deadlines.values()) - clock.now()));
  };
  return {
    sync(ids: string[], visible: boolean) {
      const wanted = new Set(visible ? ids : []);
      for (const id of deadlines.keys()) if (!wanted.has(id)) deadlines.delete(id);
      for (const id of wanted) if (!attempted.has(id) && !deadlines.has(id)) deadlines.set(id, clock.now() + 5000);
      schedule();
    },
    dispose() { if (timer !== undefined) clock.cancel(timer); deadlines.clear(); },
  };
}
