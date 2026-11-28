import * as snapshots from '../src/services/latestRead.ts';
import * as pages from '../src/services/readAllPages.ts';
import * as revisions from '../src/utils/songRevisions.ts';

/** VM fixtures execute production handlers with the real shared read coordination. */
export function dataReadContext(context: any) {
  const require = context.require;
  for (const [key, value] of Object.entries({ ...snapshots, ...pages, ...revisions, recordDiagnostic() {} })) {
    if (!(key in context)) context[key] = value;
  }
  context.require = (name: string) => name.endsWith('/latestRead') ? snapshots : name.endsWith('/readAllPages') ? pages : require?.(name);
  return context;
}
