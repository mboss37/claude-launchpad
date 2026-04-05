import React from 'react';
import { Box, Text } from 'ink';
import type { DashboardStats } from '../data/data-source.js';
import type { Memory } from '../../types.js';
import { formatBytes, computeLifespan } from '../data/formatters.js';
import { TYPE_COLORS } from '../colors.js';

interface StatsBarProps {
  readonly stats: DashboardStats;
  readonly visible: readonly Memory[];
}

export function StatsBar({ stats, visible }: StatsBarProps): React.ReactNode {
  const lifeCounts = { healthy: 0, fading: 0, stale: 0, session: 0 };
  for (const m of visible) {
    lifeCounts[computeLifespan(m).status]++;
  }

  const typeEntries = Object.entries(stats.byType).filter(([, c]) => c > 0);

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
      <Box gap={2}>
        <Text><Text bold>Total:</Text> {stats.total}</Text>
        <Text><Text bold>Relations:</Text> {stats.relations}</Text>
        <Text><Text bold>Visible:</Text> {visible.length}</Text>
        <Text><Text bold>DB:</Text> {formatBytes(stats.dbSizeBytes)}</Text>
      </Box>
      <Box gap={2}>
        <Text>
          <Text color="green">H:{lifeCounts.healthy}</Text>
          {' '}<Text color="yellow">F:{lifeCounts.fading}</Text>
          {' '}<Text color="red">S:{lifeCounts.stale}</Text>
          {' '}<Text color="magenta">Sess:{lifeCounts.session}</Text>
        </Text>
        {typeEntries.map(([type, count]) => (
          <Text key={type} color={TYPE_COLORS[type as keyof typeof TYPE_COLORS] ?? 'white'}>
            {type}:{count}
          </Text>
        ))}
      </Box>
    </Box>
  );
}
