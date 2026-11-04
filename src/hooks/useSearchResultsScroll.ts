import { useCallback, useLayoutEffect, useRef } from 'react';

// A new search starts at its first result, rather than inheriting the old list's
// scroll offset. Also reset after deferred results commit, before they paint.
export function useSearchResultsScroll(query: string, renderedQuery = query) {
  const previous = useRef({ query, renderedQuery });
  const scrollToResults = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  useLayoutEffect(() => {
    if (previous.current.query !== query || previous.current.renderedQuery !== renderedQuery) {
      scrollToResults();
    }
    previous.current = { query, renderedQuery };
  }, [query, renderedQuery, scrollToResults]);

  return scrollToResults;
}
