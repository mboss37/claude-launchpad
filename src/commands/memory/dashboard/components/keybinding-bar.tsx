import React from 'react';
import { Box, Text } from 'ink';

const HINTS = [
  ['j/k', 'navigate'],
  ['/', 'search'],
  ['p', 'projects'],
  ['1-5', 'type'],
  ['l', 'life'],
  ['s', 'sort'],
  ['r', 'remove'],
  ['d', 'delete project'],
  ['Tab', 'focus'],
  ['?', 'help'],
  ['q', 'quit'],
] as const;

export function KeybindingBar(): React.ReactNode {
  return (
    <Box>
      {HINTS.map(([key, label], i) => (
        <React.Fragment key={key}>
          {i > 0 && <Text dimColor>  </Text>}
          <Text color="cyan">{key}</Text>
          <Text dimColor> {label}</Text>
        </React.Fragment>
      ))}
    </Box>
  );
}
