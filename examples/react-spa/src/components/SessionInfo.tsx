import { Box, Code, Text } from '@chakra-ui/react';
import { useTracker } from '@releval/tracker/react';

export function SessionInfo() {
  const tracker = useTracker();
  const sessionId = tracker.sessionId;
  const clientId = tracker.clientId;

  return (
    <Box display="flex" gap="4" fontSize="xs" color="gray.500" flexWrap="wrap">
      <Text>Session: <Code fontSize="xs" title={sessionId}>{sessionId.substring(0, 12)}...</Code></Text>
      <Text>Client: <Code fontSize="xs" title={clientId}>{clientId.substring(0, 12)}...</Code></Text>
    </Box>
  );
}
