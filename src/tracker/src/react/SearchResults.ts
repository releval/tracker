import {
  createContext,
  createElement,
  type ReactElement,
  type ReactNode,
  useContext,
  useMemo,
} from "react";

/** The search that produced the results rendered beneath a {@link SearchResults}. */
export type SearchResultsValue = {
  /** The server-issued `query_id` for the search. */
  queryId: string;
  /** The query text as the user entered it, if known. */
  query?: string;
};

const SearchResultsContext = createContext<SearchResultsValue | null>(null);

/** Props for {@link SearchResults}. */
export type SearchResultsProps = SearchResultsValue & {
  /** The results subtree this search context applies to. */
  children?: ReactNode;
};

/**
 * Declares which search produced the results rendered beneath it - the SPA
 * twin of `data-query-id` on a server-rendered results container. Result
 * components read it with {@link useSearchResults} (and
 * {@link useResultImpression} reads it automatically) instead of threading
 * `queryId` down as a prop.
 *
 * ```tsx
 * <SearchResults queryId={response.query_id} query={q}>
 *   {results.map((r, i) => <ResultCard key={r.sku} result={r} ordinal={i + 1} />)}
 * </SearchResults>
 * ```
 */
export function SearchResults({
  queryId,
  query,
  children,
}: SearchResultsProps): ReactElement {
  const value = useMemo(() => ({ queryId, query }), [queryId, query]);
  return createElement(SearchResultsContext.Provider, { value }, children);
}

/**
 * The current search context, or null outside a {@link SearchResults} (e.g. a
 * card rendered on a home page that did not come from a search).
 */
export function useSearchResults(): SearchResultsValue | null {
  return useContext(SearchResultsContext);
}
