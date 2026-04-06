import React from 'react';
import { Box, Text, useInput } from 'ink';
import type { Memory } from '../../types.js';

interface DeleteConfirmProps {
  readonly memory: Memory;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function DeleteConfirm({ memory, onConfirm, onCancel }: DeleteConfirmProps): React.ReactNode {
  useInput((input, key) => {
    if (input === 'y' || input === 'Y') onConfirm();
    if (input === 'n' || input === 'N' || key.escape) onCancel();
  });

  const title = memory.title ?? memory.content.slice(0, 40);

  return (
    <Box flexDirection="column" borderStyle="double" borderColor="red" paddingX={2} paddingY={1}>
      <Text bold color="red">Delete memory?</Text>
      <Text> </Text>
      <Text bold>{title}</Text>
      <Text dimColor>[{memory.type}] {memory.project ?? '(no project)'}</Text>
      <Text> </Text>
      <Text>This is a permanent hard delete. The memory cannot be recovered.</Text>
      <Text> </Text>
      <Text><Text color="green" bold>y</Text> confirm  <Text color="red" bold>n/Esc</Text> cancel</Text>
    </Box>
  );
}
