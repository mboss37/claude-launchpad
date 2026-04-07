import React from 'react';
import { Box, Text, useInput } from 'ink';

interface PurgeConfirmProps {
  readonly project: string;
  readonly memoryCount: number;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function PurgeConfirm({ project, memoryCount, onConfirm, onCancel }: PurgeConfirmProps): React.ReactNode {
  useInput((input, key) => {
    if (input === 'y' || input === 'Y') onConfirm();
    if (input === 'n' || input === 'N' || key.escape) onCancel();
  });

  return (
    <Box flexDirection="column" borderStyle="double" borderColor="red" paddingX={2} paddingY={1}>
      <Text bold color="red">Delete all memories for project?</Text>
      <Text> </Text>
      <Text bold>{project}</Text>
      <Text dimColor>{memoryCount} memories will be permanently deleted.</Text>
      <Text> </Text>
      <Text>This cannot be undone.</Text>
      <Text> </Text>
      <Text><Text color="green" bold>y</Text> confirm  <Text color="red" bold>n/Esc</Text> cancel</Text>
    </Box>
  );
}
