import { Box, Container, Flex, Heading, Text, Badge } from '@chakra-ui/react';
import { Link, useLocation } from 'react-router-dom';
import { EventLog } from './EventLog';
import { useCart } from '../cart';
import React from 'react';

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/catalog', label: 'Catalog' },
  { to: '/cart', label: 'Cart' },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { count } = useCart();

  return (
    <Box minH="100vh" display="flex" flexDirection="column" bg="gray.50">
      {/* Navigation */}
      <Box as="header" bg="white" borderBottomWidth="1px" borderColor="gray.200" position="sticky" top="0" zIndex="100">
        <Container maxW="7xl" py="3">
          <Flex justify="space-between" align="center" flexWrap="wrap" gap="3">
            <Flex align="center" gap="8">
              <Heading size="lg" color="blue.500">
                <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>RelevalTech</Link>
              </Heading>
              <Flex gap="4" display={{ base: 'none', md: 'flex' }}>
                {navLinks.map(({ to, label }) => (
                  <Link key={to} to={to} style={{ textDecoration: 'none' }}>
                    <Flex align="center" gap="1">
                      <Text
                        fontWeight={location.pathname === to ? '700' : '500'}
                        color={location.pathname === to ? 'blue.500' : 'gray.600'}
                        _hover={{ color: 'blue.500' }}
                        fontSize="sm"
                      >
                        {label}
                      </Text>
                      {label === 'Cart' && count > 0 && (
                        <Badge bg="red.500" color="white" borderRadius="full" fontSize="xs" px="1.5" minW="5" textAlign="center">
                          {count}
                        </Badge>
                      )}
                    </Flex>
                  </Link>
                ))}
              </Flex>
            </Flex>
          </Flex>
        </Container>
      </Box>

      {/* Main content */}
      <Box flex="1">
        {children}
      </Box>

      {/* Event log */}
      <EventLog />
    </Box>
  );
}
