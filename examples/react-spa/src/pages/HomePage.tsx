import { Container, Heading, Text, SimpleGrid, Box } from '@chakra-ui/react';
import { Link } from 'react-router-dom';
import { products } from '../products';
import { ProductCard } from '../components/ProductCard';

const featured = products.slice(0, 8);

// These cards are outside any <SearchResults> context, so they report no
// result clicks or impressions - an unjoinable click is noise for
// relevance analysis. Add-to-cart conversions still resolve attribution
// when the product was clicked as a search result earlier in the session.
export function HomePage() {
  return (
    <Container maxW="7xl" py="8">
      <Heading size="xl" mb="2">Welcome to RelevalTech</Heading>
      <Text color="gray.500" mb="8">
        Featured products &mdash;{' '}
        <Link to="/catalog" style={{ color: '#3182CE', fontWeight: 600 }}>View all products</Link>
      </Text>

      <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} gap="5">
        {featured.map((product, i) => (
          <ProductCard key={product.id} product={product} position={i + 1} />
        ))}
      </SimpleGrid>

      <Box mt="8" p="4" bg="blue.50" borderRadius="lg" fontSize="sm" color="blue.700">
        <Text fontWeight="600" mb="1">ubi-tracker features on this page:</Text>
        <Text>Cards outside a search report no result events; add-to-cart conversions resolve attribution from an earlier recorded result click.</Text>
      </Box>
    </Container>
  );
}
