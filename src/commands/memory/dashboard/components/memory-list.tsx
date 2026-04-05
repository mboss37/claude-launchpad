import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import type { Memory } from '../../types.js';
import { truncate, formatRelativeTime, computeLifespan, formatLifespanLabel } from '../data/formatters.js';
import { TYPE_ABBREV } from '../colors.js';

interface MemoryListProps {
  readonly memories: readonly Memory[];
  readonly selectedIndex: number;
  readonly isFocused: boolean;
  readonly height: number;
}

type LifeColor = 'green' | 'yellow' | 'red' | 'magenta';

const LIFE_COLORS: Record<string, LifeColor> = {
  healthy: 'green',
  fading: 'yellow',
  stale: 'red',
  session: 'magenta',
};

export function MemoryList({ memories, selectedIndex, isFocused, height }: MemoryListProps): React.ReactNode {
  const viewportHeight = Math.max(1, height - 2);

  const scrollOffset = useMemo(() => {
    if (selectedIndex < 0) return 0;
    if (memories.length <= viewportHeight) return 0;
    const half = Math.floor(viewportHeight / 2);
    const offset = Math.max(0, selectedIndex - half);
    return Math.min(offset, memories.length - viewportHeight);
  }, [selectedIndex, memories.length, viewportHeight]);

  const visible = memories.slice(scrollOffset, scrollOffset + viewportHeight);
  const label = ` Memories [${memories.length}] `;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={isFocused ? 'cyan' : 'gray'}
    >
      <Text bold color={isFocused ? 'cyan' : 'gray'}>{label}</Text>
      {visible.length === 0 && <Text dimColor>  No memories found</Text>}
      {visible.map((m, i) => {
        const isSelected = scrollOffset + i === selectedIndex;
        return <MemoryRow key={m.id} memory={m} isSelected={isSelected} />;
      })}
    </Box>
  );
}

function MemoryRow({ memory, isSelected }: { memory: Memory; isSelected: boolean }): React.ReactNode {
  const life = computeLifespan(memory);
  const title = truncate(memory.title ?? memory.content.replace(/\n/g, ' '), 36);
  const project = truncate(memory.project ?? '', 14);
  const type = TYPE_ABBREV[memory.type] ?? memory.type;
  const lifeColor = LIFE_COLORS[life.status] ?? 'white';
  const lifeLabel = formatLifespanLabel(life.status).trim();
  const imp = `${Math.round(memory.importance * 100)}%`;
  const updated = formatRelativeTime(memory.updatedAt);

  return (
    <Box>
      <Text inverse={isSelected}>
        <Text bold>{isSelected ? '▸ ' : '  '}</Text>
        <Text bold>{title.padEnd(38)}</Text>
        <Text dimColor>{project.padEnd(16)}</Text>
        <Text color="cyan">{type}  </Text>
        <Text color={lifeColor}>{lifeLabel.padEnd(8)}</Text>
        <Text>{imp.padStart(4)}  </Text>
        <Text dimColor>{updated.padEnd(8)}</Text>
        <Text color="blue">acc:{memory.accessCount}</Text>
      </Text>
    </Box>
  );
}
