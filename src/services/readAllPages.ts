/** Fetch complete, deterministically ordered snapshots, even with a low API row cap. */
export async function readAllPages(makeQuery: () => any): Promise<{ data: any[] | null; error: any }> {
  const rows: any[] = [];
  const seen = new Set<string>();
  let expected: number | null = null;
  try {
    for (let offset = 0; ; ) {
      let query = makeQuery().range(offset, offset + 499);
      if (typeof query.abortSignal === 'function') query = query.abortSignal(AbortSignal.timeout(30000));
      const page = await query;
      if (page.error) return { data: null, error: page.error };
      if (typeof page.count === 'number') {
        if (expected !== null && expected !== page.count) throw new Error('Records changed while loading. Please refresh.');
        expected = page.count;
      }
      const batch = page.data || [];
      for (const row of batch) {
        if (row.id !== undefined) {
          if (seen.has(row.id)) throw new Error('Records changed while loading. Please refresh.');
          seen.add(row.id);
        }
        rows.push(row);
      }
      offset += batch.length;
      if (expected !== null ? offset >= expected : batch.length < 500) break;
      if (!batch.length) throw new Error('The response was incomplete. Please refresh.');
    }
    return { data: rows, error: null };
  } catch (error) { return { data: null, error }; }
}

/** Batch relationship filters so a growing library cannot exceed URL limits. */
export async function readRelatedPages(ids: string[], makeQuery: (ids: string[]) => any) {
  const rows: any[] = [];
  for (let offset = 0; offset < ids.length; offset += 100) {
    const result = await readAllPages(() => makeQuery(ids.slice(offset, offset + 100)));
    if (result.error) return result;
    rows.push(...result.data!);
  }
  return { data: rows, error: null };
}
