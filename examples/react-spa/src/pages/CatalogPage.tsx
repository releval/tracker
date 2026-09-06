import { Container, Heading, SimpleGrid, Box, Text } from '@chakra-ui/react';
import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SearchResults, useTracker } from '@releval/tracker/react';
import { products } from '../products';
import { ProductCard } from '../components/ProductCard';
import { SearchBar } from '../components/SearchBar';

function filterByQuery(query: string) {
  if (!query) return products;
  const q = query.toLowerCase();
  return products.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.category.toLowerCase().includes(q) ||
    p.description.toLowerCase().includes(q)
  );
}

// Simulates a search backend. In a real integration the query_id is minted by
// your server, which registers the query with Releval (POST /api/v1/ubi/track-query)
// and returns the id to the browser. This demo has no backend, so this stands in
// for that round-trip. The query_id is what makes result clicks and impressions
// joinable back to the query for relevance analysis.
function mockSearchApi(query: string) {
  return { results: filterByQuery(query), queryId: crypto.randomUUID() };
}

export function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const [filteredProducts, setFilteredProducts] = useState(() => filterByQuery(initialQuery));
  // The query_id from the last search. Held here and handed to the result cards
  // via the library's <SearchResults> context, so their click/impression
  // events carry it.
  const [queryId, setQueryId] = useState<string | null>(null);
  const tracker = useTracker();

  const handleSearch = useCallback((q: string) => {
    setQuery(q);
    if (q) {
      // Get results and the server-issued query_id from the (mock) search API,
      // then record the search WITH the query_id so downstream result clicks
      // and impressions are attributable back to this query.
      const { results, queryId: id } = mockSearchApi(q);
      setFilteredProducts(results);
      setQueryId(id);
      tracker.trackSearch({ query: q, queryId: id });
      setSearchParams({ q }, { replace: true });
    } else {
      setFilteredProducts(products);
      setQueryId(null);
      setSearchParams({}, { replace: true });
    }
  }, [setSearchParams, tracker]);

  const grid = (
    <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} gap="5">
      {filteredProducts.map((product, i) => (
        <ProductCard key={product.id} product={product} position={i + 1} />
      ))}
    </SimpleGrid>
  );

  return (
    <Container maxW="7xl" py="8">
      <Heading size="xl" mb="6">
        {query ? <>Products matching &ldquo;{query}&rdquo;</> : 'All Products'}
      </Heading>

      <SearchBar onSearch={handleSearch} initialQuery={initialQuery} />

      {filteredProducts.length === 0 ? (
        <Box textAlign="center" py="12" color="gray.400">
          <Text fontSize="lg">No products found. Try a different search.</Text>
        </Box>
      ) : queryId ? (
        // Wrap results from a search so cards can attribute clicks/impressions.
        <SearchResults queryId={queryId} query={query}>{grid}</SearchResults>
      ) : (
        grid
      )}

      <Box mt="8" p="4" bg="blue.50" borderRadius="lg" fontSize="sm" color="blue.700">
        <Text fontWeight="600" mb="1">ubi-tracker features on this page:</Text>
        <Text>A canonical search event per query, query-attributed result clicks and impressions via the library's SearchResults context and useResultImpression hook, and click-time attribution that follows each product to later routes.</Text>
      </Box>
    </Container>
  );
}
