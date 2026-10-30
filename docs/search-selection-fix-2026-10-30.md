# Song selection and search responsiveness

Song picker options now commit a stationary pointer tap on release, before hiding the keyboard can move the list. Selection no longer depends on unrelated window scroll events. Gesture movement, pointer cancellation and list movement still reject drag/scroll selections; subsequent compatibility clicks do not select twice. Keyboard selection remains available, including within the touch sheet focus trap.

Picker query text updates immediately while result computation is deferred. Browse mode renders 80 rows at a time with a Show more action, instead of mounting the whole library. Search retains its existing 30-result limit.

Shared song search caches normalized song text, updates its index when title/artist/lyrics change, reuses per-query matching and word distances, and uses bounded edit-distance calculations instead of full matrices. Query caches are capped at 16,384 entries. Both the Songs tab and setlist picker use this shared implementation.

Local Node benchmark over 1,500 cached library records, in the same VM harness before and after:

| Query | Before | After |
|---|---:|---:|
| grace | 489 ms | 173 ms |
| dakilang | 1,178 ms | 128 ms |
| amzing | 880 ms | 111 ms |
| no-match query | 1,460 ms | 74 ms |
| long lyric phrase | 5,419 ms | 156 ms |

These are local search-computation timings, not measured phone input latency. All 7,500 song/query comparisons retained the same match flags, scores, matched fields and snippets. Tests cover cache invalidation and touch selection after searching/scrolling, cancelled drags and keyboard selection.

Web-only delivery: the regression workflow no longer builds Android on pushes. The separate manual Android workflow is retained for a future explicit request. No APK is built or delivered for this update.
