/** A compact identity for cache invalidation, not a security or integrity hash. */
export function audioVersion(source?: string): string | undefined {
  if (!source?.trim()) return undefined;
  let first = 2166136261, second = 5381;
  for (const char of source.trim()) {
    first = Math.imul(first ^ char.charCodeAt(0), 16777619);
    second = Math.imul(second, 33) ^ char.charCodeAt(0);
  }
  return (first >>> 0).toString(16).padStart(8, '0') + (second >>> 0).toString(16).padStart(8, '0');
}
