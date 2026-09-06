import { Box, Button, Text, Badge, Code } from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import { useTracker } from '@releval/tracker/react';
import { subscribeToEventLog, clearEventLog, EventLogEntry } from '../tracker';

const typeColors: Record<string, string> = {
  EVENT: 'blue',
  INFO: 'green',
  WARN: 'orange',
  ERROR: 'red',
  DEBUG: 'gray',
};

export function EventLog() {
  const tracker = useTracker();
  const [entries, setEntries] = useState<EventLogEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  useEffect(() => {
    return subscribeToEventLog(setEntries);
  }, []);

  return (
    <>
      <Button
        position="fixed"
        bottom="5"
        right="5"
        zIndex="200"
        bg="gray.800"
        color="white"
        borderRadius="full"
        px="5"
        py="3"
        boxShadow="lg"
        _hover={{ bg: 'gray.700' }}
        onClick={() => setOpen(!open)}
        size="sm"
      >
        Events{' '}
        <Badge ml="2" bg="red.500" color="white" borderRadius="full" fontSize="xs" px="2">
          {entries.length}
        </Badge>
      </Button>

      {open && (
        <Box
          position="fixed"
          bottom="16"
          right="5"
          width="420px"
          maxH="50vh"
          bg="gray.900"
          color="gray.200"
          borderRadius="xl"
          boxShadow="2xl"
          zIndex="200"
          display="flex"
          flexDirection="column"
          overflow="hidden"
        >
          <Box p="3" borderBottomWidth="1px" borderColor="gray.700">
            <Box display="flex" justifyContent="space-between" alignItems="center" mb="2">
              <Text fontWeight="600" fontSize="sm">Event Log</Text>
              <Button size="xs" variant="solid" colorPalette="gray" bg="gray.800" onClick={clearEventLog}>Clear</Button>
            </Box>
            <Box fontSize="2xs" color="gray.500" fontFamily="mono">
              <Text>Session: <Code fontSize="2xs" color="gray.400" bg="gray.800" px="1">{tracker.sessionId}</Code></Text>
              <Text>Client: <Code fontSize="2xs" color="gray.400" bg="gray.800" px="1">{tracker.clientId}</Code></Text>
            </Box>
          </Box>
          <Box flex="1" overflowY="auto" p="2" maxH="45vh">
            {entries.length === 0 && (
              <Text fontSize="xs" color="gray.500" textAlign="center" py="4">No events yet. Interact with the site!</Text>
            )}
            {entries.slice(-200).map((entry, i) => (
              <Box
                key={i}
                data-testid="event-entry"
                p="1.5"
                borderBottomWidth="1px"
                borderColor="gray.800"
                fontSize="xs"
                fontFamily="mono"
                cursor="pointer"
                _hover={{ bg: 'gray.800' }}
                onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
              >
                <Box display="flex" gap="2" alignItems="center">
                  <Text color="gray.500" flexShrink={0}>
                    {entry.timestamp.toLocaleTimeString()}
                  </Text>
                  <Badge
                    data-testid="event-type"
                    colorPalette={typeColors[entry.type] || 'gray'}
                    fontSize="2xs"
                    variant="solid"
                  >
                    {entry.type}
                  </Badge>
                  <Text data-testid="event-message" fontWeight="600" truncate>{entry.message}</Text>
                </Box>
                {expandedIdx === i && (
                  <Box data-testid="event-detail" mt="2" p="2" bg="gray.800" borderRadius="md" whiteSpace="pre-wrap" wordBreak="break-all" color="gray.400" maxH="200px" overflowY="auto">
                    {JSON.stringify(entry.data, null, 2)}
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </>
  );
}
