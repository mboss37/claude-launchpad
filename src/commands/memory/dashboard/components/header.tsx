import React from 'react';
import { Box, Text } from 'ink';
import type { MemoryType } from '../../types.js';
import type { LifespanStatus } from '../data/formatters.js';
import type { SortMode } from '../hooks/use-dashboard-state.js';

interface HeaderProps {
  readonly project?: string;
  readonly typeFilter?: MemoryType;
  readonly lifespanFilter?: LifespanStatus;
  readonly sortMode: SortMode;
  readonly searchQuery: string;
}

export function Header({ project, typeFilter, lifespanFilter, sortMode, searchQuery }: HeaderProps): React.ReactNode {
  return (
    <Box>
      <Text bold color="green"> agentic-memory </Text>
      <Text dimColor> | </Text>
      <Text color="white">{project ?? 'all projects'}</Text>
      <Text dimColor> | </Text>
      <Text dimColor>{typeFilter ?? 'all types'}</Text>
      <Text dimColor> | </Text>
      <Text dimColor>{lifespanFilter ?? 'all life'}</Text>
      <Text dimColor> | </Text>
      <Text dimColor>sort:{sortMode}</Text>
      {searchQuery && (
        <>
          <Text dimColor> | </Text>
          <Text color="yellow">search:{searchQuery}</Text>
        </>
      )}
    </Box>
  );
}
