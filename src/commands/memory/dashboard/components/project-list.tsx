import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import type { Memory } from '../../types.js';
import { computeLifespan } from '../data/formatters.js';

interface ProjectListProps {
  readonly memories: readonly Memory[];
  readonly activeProject?: string;
  readonly isFocused: boolean;
  readonly height: number;
}

interface ProjectRow {
  readonly project: string | undefined;
  readonly total: number;
  readonly healthPct: number;
}

export function ProjectList({ memories, activeProject, isFocused, height }: ProjectListProps): React.ReactNode {
  const rows = useMemo(() => buildProjectRows(memories), [memories]);
  // Reserve rows for title + borders; leave one for "+N more" if truncated
  const visibleRows = Math.max(1, height - 3);
  const truncated = rows.length > visibleRows;
  const displayed = truncated ? rows.slice(0, visibleRows - 1) : rows;
  const hidden = rows.length - displayed.length;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={isFocused ? 'magenta' : 'gray'}
      height={height}
    >
      <Text bold color={isFocused ? 'magenta' : 'gray'}> Projects </Text>
      {displayed.map((row) => {
        const isActive = row.project === activeProject || (row.project === undefined && !activeProject);
        const name = (row.project ?? 'All projects').padEnd(20).slice(0, 20);
        const healthColor = row.healthPct > 62 ? 'green' : row.healthPct > 32 ? 'yellow' : 'red';
        return (
          <Box key={row.project ?? '_all'}>
            <Text bold={isActive}>{isActive ? '> ' : '  '}</Text>
            <Text bold={isActive}>{name}</Text>
            <Text color="cyan">{String(row.total).padStart(4)} mem</Text>
            <Text>  </Text>
            <Text color={healthColor}>{String(row.healthPct).padStart(3)}%</Text>
          </Box>
        );
      })}
      {truncated && <Text dimColor>  … +{hidden} more</Text>}
    </Box>
  );
}

function buildProjectRows(memories: readonly Memory[]): readonly ProjectRow[] {
  const byProject = new Map<string, Memory[]>();
  for (const m of memories) {
    const key = m.project ?? '(none)';
    const list = byProject.get(key) ?? [];
    list.push(m);
    byProject.set(key, list);
  }

  const rows: ProjectRow[] = [];
  for (const [project, mems] of byProject) {
    const avg = mems.reduce((s, m) => s + computeLifespan(m).remaining, 0) / mems.length;
    rows.push({ project, total: mems.length, healthPct: Math.round(avg * 100) });
  }
  rows.sort((a, b) => b.total - a.total);

  const allHealth = memories.length > 0
    ? Math.round((memories.reduce((s, m) => s + computeLifespan(m).remaining, 0) / memories.length) * 100)
    : 0;
  return [{ project: undefined, total: memories.length, healthPct: allHealth }, ...rows];
}
