import React from 'react';
import { Box, Text, useInput } from 'ink';

interface HelpOverlayProps {
  readonly onClose: () => void;
}

const BINDINGS = [
  ['j / k / ↑↓', 'Navigate list'],
  ['Enter', 'Select memory'],
  ['/', 'Search (live filter)'],
  ['Esc', 'Clear search'],
  ['1-5', 'Filter by type (0 = all)'],
  ['l', 'Cycle lifespan filter'],
  ['s', 'Cycle sort mode'],
  ['p', 'Open project picker'],
  ['[ / ]', 'Previous / next project'],
  ['Tab', 'Focus next pane'],
  ['r', 'Refresh'],
  ['?', 'Show this help'],
  ['q', 'Quit'],
] as const;

export function HelpOverlay({ onClose }: HelpOverlayProps): React.ReactNode {
  useInput(() => onClose());

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor="yellow"
      paddingX={2}
      paddingY={1}
    >
      <Text bold color="yellow">Keybindings</Text>
      <Text> </Text>
      {BINDINGS.map(([key, desc]) => (
        <Box key={key} gap={1}>
          <Text color="cyan">{key.padEnd(14)}</Text>
          <Text>{desc}</Text>
        </Box>
      ))}
      <Text> </Text>
      <Text dimColor>Press any key to close</Text>
    </Box>
  );
}
