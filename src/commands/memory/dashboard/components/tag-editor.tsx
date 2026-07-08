import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

interface TagEditorProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onSubmit: () => void;
}

export function TagEditor({ value, onChange, onSubmit }: TagEditorProps): React.ReactNode {
  return (
    <Box>
      <Text color="cyan">Tags (comma-separated): </Text>
      <TextInput value={value} onChange={onChange} onSubmit={onSubmit} />
      <Text dimColor>  (Enter save · Esc cancel)</Text>
    </Box>
  );
}
