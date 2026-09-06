import { Box, Text, Button, Badge } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import {
  useResultImpression,
  useSearchResults,
  useTracker,
} from '@releval/tracker/react';
import { ProductSvg } from '../ProductSvg';
import { Product } from '../products';
import { addToCart } from '../cart';
import { toaster } from '../toaster';

type Props = {
  product: Product;
  position: number;
};

export function ProductCard({ product, position }: Props) {
  const navigate = useNavigate();
  const tracker = useTracker();
  const search = useSearchResults();
  // One canonical impression the first time the card becomes visible,
  // attributed to the surrounding <SearchResults>. Outside a search context
  // (home page, related products) the hook no-ops: there is nothing joinable
  // to report. A new queryId re-arms it, so consecutive searches that return
  // the same product are each counted.
  const impressionRef = useResultImpression({
    objectId: product.id,
    ordinal: position,
    objectIdField: 'product_id',
    // Extra keys become custom event attributes on the impression.
    category: product.category,
  });

  return (
    <Box
      ref={impressionRef}
      data-product-card=""
      data-product-id={product.id}
      data-position={position}
      borderWidth="1px"
      borderColor="gray.200"
      borderRadius="xl"
      overflow="hidden"
      p="4"
      bg="white"
      cursor="pointer"
      transition="all 0.15s"
      _hover={{ shadow: 'lg', transform: 'translateY(-2px)' }}
      display="flex"
      flexDirection="column"
      onClick={() => {
        // Inside a search context this is a result click: it carries the
        // query_id and records attribution so later conversions for this
        // product (add_to_cart on the next route, purchase two routes on)
        // resolve the originating query. Outside a search there is nothing
        // joinable, so no click event is sent at all.
        if (search) {
          tracker.trackResultClick({
            objectId: product.id,
            ordinal: position,
            objectIdField: 'product_id',
            queryId: search.queryId,
            query: search.query,
            category: product.category,
          });
        }
        navigate(`/product/${product.id}`);
      }}
    >
      <ProductSvg productId={product.id} style={{ width: '100%', height: '140px', borderRadius: '8px', marginBottom: '12px' }} />
      <Badge colorPalette="gray" fontSize="xs" mb="1" w="fit-content">{product.category}</Badge>
      <Text fontWeight="600" fontSize="md">{product.name}</Text>
      <Text fontWeight="700" color="blue.500" fontSize="lg">${product.price.toFixed(2)}</Text>
      <Text fontSize="sm" color="gray.500" flex="1" mb="3">{product.description}</Text>
      <Button
        data-add-to-cart=""
        data-product-id={product.id}
        colorPalette="blue"
        size="sm"
        w="full"
        onClick={(e) => {
          e.stopPropagation();
          // Canonical conversion event. Inside a search context the card
          // knows the query and its own rank, so a grid-direct add-to-cart
          // is fully attributed even without a prior result click; outside
          // one, query_id and ordinal resolve from the recorded click when
          // there is one.
          tracker.trackResultEvent({
            actionName: 'add_to_cart',
            objectId: product.id,
            objectIdField: 'product_id',
            queryId: search?.queryId,
            query: search?.query,
            ordinal: search ? position : undefined,
            category: product.category,
          });
          addToCart(product.id);
          toaster.create({
            title: `Added ${product.name} to cart`,
            type: 'success',
            duration: 2000,
          });
        }}
      >
        Add to Cart
      </Button>
    </Box>
  );
}
