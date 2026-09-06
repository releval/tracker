import { Container, Heading, Text, Box, Button, Flex, Input } from '@chakra-ui/react';
import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useCart, clearCart } from '../cart';
import { products } from '../products';
import { useTracker } from '@releval/tracker/react';

export function CheckoutPage() {
  const navigate = useNavigate();
  const { items, count, total } = useCart();
  const [ordered, setOrdered] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [orderTotal, setOrderTotal] = useState(0);
  const [orderCount, setOrderCount] = useState(0);
  const tracker = useTracker();
  const shippingTracked = useRef(false);
  const trackingAttached = useRef(false);

  useEffect(() => {
    if (items.length === 0 && !ordered) {
      navigate('/cart');
      return;
    }

    if (trackingAttached.current) return;
    trackingAttached.current = true;

    tracker.dispatch({
      action_name: 'begin_checkout',
      event_attributes: {
        cart_items: count,
        cart_total: total,
      },
    });
  }, []);

  const handleAddressBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value.trim() && !shippingTracked.current) {
      shippingTracked.current = true;
      const city = (document.getElementById('city') as HTMLInputElement)?.value || '';
      const zip = (document.getElementById('zip') as HTMLInputElement)?.value || '';
      tracker.dispatch({
        action_name: 'add_shipping_info',
        event_attributes: { city, zip },
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // One canonical purchase event per line item. Each resolves the
    // query_id and ordinal recorded when that product's search result
    // was clicked - a cart built from several searches attributes each
    // item to its own query.
    items.forEach(item => {
      tracker.trackResultEvent({
        actionName: 'purchase',
        objectId: item.productId,
        objectIdField: 'product_id',
      });
    });

    const id = 'NT-' + Date.now().toString(36).toUpperCase();
    setOrderId(id);
    setOrderTotal(total);
    setOrderCount(count);
    clearCart();
    setOrdered(true);
  };

  if (ordered) {
    return (
      <Container maxW="7xl" py="8">
        <Box textAlign="center" py="16" bg="white" borderWidth="1px" borderColor="gray.200" borderRadius="xl">
          <Heading size="xl" color="green.500" mb="2">Order Confirmed!</Heading>
          <Text fontSize="lg" color="gray.500" mb="4">Thank you for your purchase.</Text>
          <Text mb="2">
            Order ID: <Box as="code" bg="gray.100" px="3" py="1" borderRadius="md" fontSize="sm">{orderId}</Box>
          </Text>
          <Text mb="6">Total: ${orderTotal.toFixed(2)} ({orderCount} items)</Text>
          <Link to="/">
            <Button colorPalette="blue" size="lg">Continue Shopping</Button>
          </Link>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxW="7xl" py="8">
      <Heading size="xl" mb="6">Checkout</Heading>

      <Flex gap="8" direction={{ base: 'column', md: 'row' }}>
        {/* Form */}
        <Box flex="1">
          <Box as="form" onSubmit={handleSubmit}>
            <Box mb="4">
              <Text fontSize="sm" fontWeight="600" color="gray.600" mb="1">Full Name</Text>
              <Input placeholder="John Doe" required bg="white" />
            </Box>
            <Box mb="4">
              <Text fontSize="sm" fontWeight="600" color="gray.600" mb="1">Email</Text>
              <Input type="email" placeholder="john@example.com" required bg="white" />
            </Box>
            <Box mb="4">
              <Text fontSize="sm" fontWeight="600" color="gray.600" mb="1">Address</Text>
              <Input id="address" placeholder="123 Main St" required bg="white" onBlur={handleAddressBlur} />
            </Box>
            <Flex gap="4" mb="4">
              <Box flex="1">
                <Text fontSize="sm" fontWeight="600" color="gray.600" mb="1">City</Text>
                <Input id="city" placeholder="San Francisco" required bg="white" />
              </Box>
              <Box flex="1">
                <Text fontSize="sm" fontWeight="600" color="gray.600" mb="1">ZIP Code</Text>
                <Input id="zip" placeholder="94102" required bg="white" />
              </Box>
            </Flex>
            <Button type="submit" colorPalette="green" size="lg" w="full" mt="4">
              Place Order
            </Button>
          </Box>
        </Box>

        {/* Order Summary */}
        <Box flex="0 0 320px">
          <Box bg="white" borderWidth="1px" borderColor="gray.200" borderRadius="xl" p="6">
            <Heading size="md" mb="4">Order Summary</Heading>

            {items.map(item => {
              const product = products.find(p => p.id === item.productId);
              if (!product) return null;
              return (
                <Flex key={item.productId} justify="space-between" align="center" py="2" borderBottomWidth="1px" borderColor="gray.100" fontSize="sm">
                  <Text flex="1">{product.name}</Text>
                  <Text color="gray.500" mx="3">&times;{item.quantity}</Text>
                  <Text fontWeight="600">${(product.price * item.quantity).toFixed(2)}</Text>
                </Flex>
              );
            })}

            <Flex justify="space-between" mt="3" fontSize="md">
              <Text>Subtotal</Text>
              <Text>${total.toFixed(2)}</Text>
            </Flex>
            <Flex justify="space-between" fontSize="md">
              <Text>Shipping</Text>
              <Text>Free</Text>
            </Flex>
            <Flex justify="space-between" fontSize="xl" fontWeight="700" borderTopWidth="2px" borderColor="gray.200" pt="3" mt="3">
              <Text>Total</Text>
              <Text color="blue.500">${total.toFixed(2)}</Text>
            </Flex>
          </Box>
        </Box>
      </Flex>

      <Box mt="8" p="4" bg="blue.50" borderRadius="lg" fontSize="sm" color="blue.700">
        <Text fontWeight="600" mb="1">ubi-tracker features on this page:</Text>
        <Text>
          begin_checkout event on page load, add_shipping_info when address field loses focus,
          purchase event on form submission
        </Text>
      </Box>
    </Container>
  );
}
