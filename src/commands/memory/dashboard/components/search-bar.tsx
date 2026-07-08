import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

interface SearchBarProps {
  readonly query: string;
  readonly onChange: (value: string) => void;
  readonly onSubmit: () => void;
}

export function SearchBar({ query, onChange, onSubmit }: SearchBarProps): React.ReactNode {
  return (
    <Box>
      <Text color="yellow">Search: </Text>
      <TextInput value={query} onChange={onChange} onSubmit={onSubmit} />
      <Text dimColor>  (Enter apply · Esc cancel)</Text>
    </Box>
  );
}
