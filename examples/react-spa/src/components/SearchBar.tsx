import { Input, Box, Button, Text } from '@chakra-ui/react';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { products } from '../products';

type Props = {
  onSearch: (query: string) => void;
  inputId?: string;
  initialQuery?: string;
};

export function SearchBar({ onSearch, inputId = 'catalog-search', initialQuery = '' }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<typeof products>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    setActiveIndex(-1);

    if (value.trim().length >= 2) {
      const q = value.toLowerCase();
      const matches = products.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      ).slice(0, 5);
      setSuggestions(matches);
      setShowSuggestions(matches.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (product: typeof products[0], index: number) => {
    setShowSuggestions(false);
    setActiveIndex(-1);
    navigate(index < 2 ? `/promotion/${product.id}` : `/product/${product.id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => (i < suggestions.length - 1 ? i + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => (i > 0 ? i - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[activeIndex], activeIndex);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setActiveIndex(-1);
    }
  };

  // The search itself is reported by CatalogPage.handleSearch via
  // tracker.trackSearch (a canonical `search` event with the
  // server-issued query_id), so submitting here only raises the query.
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    setActiveIndex(-1);
    onSearch(query.trim());
  }, [query, onSearch]);

  return (
    <Box ref={wrapperRef} position="relative" mb="6">
      <Box as="form" onSubmit={handleSubmit} display="flex" gap="2">
        <Input
          id={inputId}
          placeholder="Search products... (try 'audio', 'camera', 'smart')"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
          flex="1"
          bg="white"
          autoComplete="off"
        />
        <Button type="submit" colorPalette="blue" px="8">Search</Button>
      </Box>

      {showSuggestions && (
        <Box
          position="absolute"
          top="100%"
          left="0"
          right="80px"
          mt="1"
          bg="white"
          borderWidth="1px"
          borderColor="gray.200"
          borderRadius="lg"
          shadow="lg"
          zIndex="10"
          overflow="hidden"
        >
          {suggestions.map((product, i) => (
            <Box
              key={product.id}
              px="4"
              py="2"
              cursor="pointer"
              bg={i === activeIndex ? 'blue.50' : undefined}
              _hover={{ bg: 'blue.50' }}
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              borderBottomWidth="1px"
              borderColor="gray.100"
              onClick={() => selectSuggestion(product, i)}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <Box>
                <Text fontSize="sm" fontWeight="600">
                  {product.name}
                  {i < 2 && (
                    <Box as="span" ml="2" px="2" py="0.5" bg="blue.500" color="white" fontSize="2xs" fontWeight="700" borderRadius="full" verticalAlign="middle">
                      PROMOTED
                    </Box>
                  )}
                </Text>
                <Text fontSize="xs" color="gray.500">{product.category}</Text>
              </Box>
              <Text fontSize="sm" fontWeight="600" color="blue.500">${product.price.toFixed(2)}</Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
