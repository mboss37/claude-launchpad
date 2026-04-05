import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

interface SearchBarProps {
  readonly query: string;
  readonly onChange: (value: string) => void;
  readonly onClose: () => void;
}

export function SearchBar({ query, onChange, onClose }: SearchBarProps): React.ReactNode {
  return (
    <Box>
      <Text color="yellow">Search: </Text>
      <TextInput value={query} onChange={onChange} onSubmit={onClose} />
      <Text dimColor>  (Esc to clear, Enter to keep)</Text>
    </Box>
  );
}
