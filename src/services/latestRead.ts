/** Share the newest result with callers whose earlier request finishes late. */
const reads = new Map<string, { promise: Promise<any> }>();
const writes = new Map<string, { count: number; done: Promise<void>; resolve: () => void }>();
export function latestRead<T>(key: string, load: () => Promise<T>): Promise<T> {
  const entry = { promise: null as unknown as Promise<T> };
  entry.promise = Promise.resolve().then(async () => {
    while (writes.has(key)) await writes.get(key)!.done;
    if (reads.get(key) !== entry) return reads.get(key)?.promise ?? latestRead(key, load);
    return load();
  }).then(
    value => reads.get(key) === entry ? value : (reads.get(key)?.promise ?? latestRead(key, load)),
    error => {
      if (reads.get(key) !== entry) return reads.get(key)?.promise ?? latestRead(key, load);
      throw error;
    },
  );
  reads.set(key, entry);
  return entry.promise;
}

/** Invalidate in-flight reads at both edges of a mutation, including failed writes. */
export function invalidateRead(key: string) { reads.delete(key); }

export function beginReadMutation(key: string): () => void {
  invalidateRead(key);
  let write = writes.get(key);
  if (!write) {
    let resolve!: () => void;
    const done = new Promise<void>(finish => { resolve = finish; });
    write = { count: 0, done, resolve }; writes.set(key, write);
  }
  write.count++;
  let finished = false;
  return () => {
    if (finished) return; finished = true;
    invalidateRead(key);
    if (--write!.count === 0) { writes.delete(key); write!.resolve(); }
  };
}
