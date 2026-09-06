import { Container, Heading, Text, Button, Box, Badge, SimpleGrid, Input, Flex } from '@chakra-ui/react';
import { useParams, Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { products } from '../products';
import { ProductSvg } from '../ProductSvg';
import { ProductCard } from '../components/ProductCard';
import { useTracker } from '@releval/tracker/react';
import { addToCart } from '../cart';
import { toaster } from '../toaster';

export function PromotionPage() {
  const { id } = useParams<{ id: string }>();
  const product = products.find(p => p.id === id);
  const [qty, setQty] = useState(1);
  const tracker = useTracker();
  const lastTrackedId = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!product) return;
    if (lastTrackedId.current === product.id) return;
    lastTrackedId.current = product.id;

    // Emit a canonical view event for this product. A promoted
    // suggestion navigates here without a result click, so there is
    // no recorded attribution and the view is sent unattributed -
    // deliberately, because inventing a query link would poison the
    // relevance data.
    tracker.trackResultEvent({
      actionName: 'view',
      objectId: product.id,
      objectIdField: 'product_id',
    });
    // Related product cards report their own clicks (see ProductCard.tsx).
  }, [product?.id, tracker]);

  if (!product) {
    return (
      <Container maxW="7xl" py="8">
        <Heading>Promotion not found</Heading>
        <Link to="/catalog" style={{ color: '#3182CE' }}>Back to catalog</Link>
      </Container>
    );
  }

  const related = products
    .filter(p => p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  const handleAddToCart = () => {
    // Canonical conversion: query_id and ordinal resolve from the
    // recorded result click when there is one.
    tracker.trackResultEvent({
      actionName: 'add_to_cart',
      objectId: product.id,
      objectIdField: 'product_id',
    });
    addToCart(product.id, qty);
    toaster.create({
      title: `Added ${qty}x ${product.name} to cart`,
      type: 'success',
      duration: 2000,
    });
  };

  return (
    <Container maxW="7xl" py="8">
      <Link to="/catalog" style={{ color: '#3182CE', fontSize: '14px' }}>
        &larr; Back to catalog
      </Link>

      <Box bg="blue.50" borderRadius="xl" p="8" mt="4">
        <Badge colorPalette="blue" fontSize="sm" mb="3">Featured Deal</Badge>
        <Box display={{ md: 'flex' }} gap="8">
          <Box flex="1" maxW={{ md: '400px' }}>
            <ProductSvg
              productId={product.id}
              style={{ width: '100%', height: '280px', borderRadius: '12px', background: '#fff', border: '1px solid #E2E8F0' }}
            />
          </Box>

          <Box flex="1" mt={{ base: '4', md: '0' }}>
            <Badge colorPalette="gray" mb="2">{product.category}</Badge>
            <Heading size="2xl" mb="2">{product.name}</Heading>
            <Text fontSize="2xl" fontWeight="700" color="blue.500" mb="4">
              ${product.price.toFixed(2)}
            </Text>
            <Text color="gray.600" mb="6" fontSize="lg">{product.description}</Text>

            <Flex gap="3" align="center">
              <Input
                type="number"
                value={qty}
                onChange={(e) => setQty(Math.max(1, Math.min(99, parseInt(e.target.value) || 1)))}
                min={1}
                max={99}
                w="80px"
                textAlign="center"
                bg="white"
              />
              <Button
                data-add-to-cart=""
                data-product-id={product.id}
                colorPalette="blue"
                size="lg"
                px="12"
                onClick={handleAddToCart}
              >
                Add to Cart
              </Button>
            </Flex>
          </Box>
        </Box>
      </Box>

      {related.length > 0 && (
        <Box mt="12">
          <Heading size="lg" mb="4">Related Products</Heading>
          <SimpleGrid columns={{ base: 1, sm: 2, md: 4 }} gap="5">
            {related.map((p, i) => (
              <ProductCard key={p.id} product={p} position={i + 1} />
            ))}
          </SimpleGrid>
        </Box>
      )}

      <Box mt="8" p="4" bg="blue.50" borderRadius="lg" fontSize="sm" color="blue.700">
        <Text fontWeight="600" mb="1">ubi-tracker features on this page:</Text>
        <Text>
          A canonical view event, and add-to-cart conversions that resolve
          attribution from a recorded result click when one exists.
        </Text>
      </Box>
    </Container>
  );
}
