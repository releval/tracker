import { Container, Heading, Text, Box, Button, Flex, Input } from '@chakra-ui/react';
import { Link } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { useCart, removeFromCart, updateQuantity } from '../cart';
import { products } from '../products';
import { ProductSvg } from '../ProductSvg';
import { useTracker } from '@releval/tracker/react';

export function CartPage() {
  const { items, count, total } = useCart();
  const tracker = useTracker();
  const trackingAttached = useRef(false);

  useEffect(() => {
    if (trackingAttached.current) return;
    trackingAttached.current = true;

    tracker.dispatch({
      action_name: 'view',
      event_attributes: {
        cart_items: items.length,
        cart_total: total,
      },
    });
  }, []);

  const handleQuantityChange = (productId: string, newQty: number) => {
    updateQuantity(productId, newQty);
    tracker.dispatch({
      action_name: 'update_cart',
      event_attributes: {
        object: { object_id: productId, object_id_field: 'product_id' },
        quantity: newQty,
      },
    });
  };

  const handleRemove = (productId: string) => {
    removeFromCart(productId);
    // Canonical conversion: resolves the originating query from the
    // recorded result click, if there was one.
    tracker.trackResultEvent({
      actionName: 'remove_from_cart',
      objectId: productId,
      objectIdField: 'product_id',
    });
  };

  if (items.length === 0) {
    return (
      <Container maxW="7xl" py="8">
        <Heading size="xl" mb="6">Shopping Cart</Heading>
        <Box textAlign="center" py="12" bg="white" borderRadius="xl" borderWidth="1px" borderColor="gray.200">
          <Text fontSize="lg" color="gray.500" mb="4">Your cart is empty.</Text>
          <Link to="/catalog">
            <Button colorPalette="blue" size="lg">Browse Catalog</Button>
          </Link>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxW="7xl" py="8">
      <Heading size="xl" mb="6">Shopping Cart</Heading>

      <Box display="flex" flexDirection="column" gap="3">
        {items.map(item => {
          const product = products.find(p => p.id === item.productId);
          if (!product) return null;
          const lineTotal = product.price * item.quantity;

          return (
            <Box
              key={item.productId}
              display="flex"
              alignItems="center"
              gap="4"
              p="4"
              bg="white"
              borderWidth="1px"
              borderColor="gray.200"
              borderRadius="xl"
            >
              <Box flexShrink={0} w="80px">
                <ProductSvg productId={product.id} style={{ width: '80px', height: '56px', borderRadius: '6px' }} />
              </Box>

              <Box flex="1">
                <Link to={`/product/${product.id}`} style={{ color: 'inherit', fontWeight: 600 }}>
                  {product.name}
                </Link>
                <Text fontSize="sm" color="gray.500">${product.price.toFixed(2)} each</Text>
              </Box>

              <Flex align="center" gap="3">
                <Input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => handleQuantityChange(item.productId, parseInt(e.target.value) || 1)}
                  min={1}
                  max={99}
                  w="70px"
                  textAlign="center"
                  size="sm"
                  bg="white"
                />
                <Button
                  variant="ghost"
                  colorPalette="red"
                  size="sm"
                  onClick={() => handleRemove(item.productId)}
                >
                  Remove
                </Button>
              </Flex>

              <Text fontWeight="700" color="blue.500" fontSize="lg" minW="80px" textAlign="right">
                ${lineTotal.toFixed(2)}
              </Text>
            </Box>
          );
        })}
      </Box>

      <Box bg="white" borderWidth="1px" borderColor="gray.200" borderRadius="xl" p="6" mt="6">
        <Flex justify="space-between" fontSize="md" mb="2">
          <Text>Items</Text>
          <Text>{count}</Text>
        </Flex>
        <Flex justify="space-between" fontSize="xl" fontWeight="700" borderTopWidth="2px" borderColor="gray.200" pt="3" mt="3">
          <Text>Total</Text>
          <Text color="blue.500">${total.toFixed(2)}</Text>
        </Flex>
      </Box>

      <Flex justify="space-between" align="center" mt="6">
        <Link to="/catalog" style={{ color: '#3182CE' }}>Continue Shopping</Link>
        <Link to="/checkout">
          <Button colorPalette="green" size="lg" px="8">Proceed to Checkout</Button>
        </Link>
      </Flex>

      <Box mt="8" p="4" bg="blue.50" borderRadius="lg" fontSize="sm" color="blue.700">
        <Text fontWeight="600" mb="1">ubi-tracker features on this page:</Text>
        <Text>
          view event on page load, update_cart on quantity change, and a
          canonical remove_from_cart per removed item.
        </Text>
      </Box>
    </Container>
  );
}
