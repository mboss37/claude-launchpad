import React from 'react';
import { Box, Text } from 'ink';
import type { MemoryType } from '../../types.js';
import type { LifespanStatus } from '../data/formatters.js';
import type { SortMode } from '../hooks/use-dashboard-state.js';
import type { LayoutMode } from '../hooks/use-terminal-size.js';

interface HeaderProps {
  readonly project?: string;
  readonly typeFilter?: MemoryType;
  readonly lifespanFilter?: LifespanStatus;
  readonly sortMode: SortMode;
  readonly searchQuery: string;
  readonly layout: LayoutMode;
}

export function Header({ project, typeFilter, lifespanFilter, sortMode, searchQuery, layout }: HeaderProps): React.ReactNode {
  const sep = <Text dimColor> | </Text>;

  return (
    <Box overflow="hidden">
      <Text bold color="green"> agentic-memory </Text>
      {sep}
      <Text color="white">{project ?? 'all projects'}</Text>
      {layout !== 'narrow' && (
        <>
          {sep}
          <Text dimColor>{typeFilter ?? 'all types'}</Text>
          {sep}
          <Text dimColor>{lifespanFilter ?? 'all life'}</Text>
        </>
      )}
      {layout === 'wide' && (
        <>
          {sep}
          <Text dimColor>sort:{sortMode}</Text>
        </>
      )}
      {searchQuery && (
        <>
          {sep}
          <Text color="yellow">/{searchQuery}</Text>
        </>
      )}
    </Box>
  );
}
