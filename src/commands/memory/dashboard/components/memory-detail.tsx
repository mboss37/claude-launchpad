import React from 'react';
import { Box, Text } from 'ink';
import type { Memory, Relation } from '../../types.js';
import {
  formatImportanceBar,
  formatRelativeTime,
  computeLifespan,
  formatLifespanLabel,
} from '../data/formatters.js';
import { TYPE_COLORS, RELATION_COLORS } from '../colors.js';

interface MemoryDetailProps {
  readonly memory?: Memory;
  readonly relations: readonly Relation[];
  readonly isFocused: boolean;
}

export function MemoryDetail({ memory, relations, isFocused }: MemoryDetailProps): React.ReactNode {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={isFocused ? 'blue' : 'gray'}
      paddingX={1}
    >
      <Text bold color={isFocused ? 'blue' : 'gray'}> Detail </Text>
      {!memory ? (
        <Text dimColor>Select a memory to view details</Text>
      ) : (
        <DetailContent memory={memory} relations={relations} />
      )}
    </Box>
  );
}

function DetailContent({ memory, relations }: { memory: Memory; relations: readonly Relation[] }): React.ReactNode {
  const life = computeLifespan(memory);
  const typeColor = TYPE_COLORS[memory.type] ?? 'white';

  return (
    <Box flexDirection="column">
      <Text bold>{memory.title ?? '(untitled)'}</Text>
      <Text> </Text>
      <Text>Type:       <Text color={typeColor}>{memory.type}</Text></Text>
      <Text>Lifespan:   {formatLifespanLabel(life.status)} | age {Math.round(life.ageDays)}d | tau {life.tauDays}d</Text>
      <Text>Health:     {formatImportanceBar(life.remaining)} {(life.remaining * 100).toFixed(0)}%</Text>
      <Text>Importance: {formatImportanceBar(memory.importance)} {memory.importance.toFixed(2)}</Text>
      <Text>Project:    {memory.project ?? '(none)'}</Text>
      <Text>Tags:       {memory.tags.length > 0 ? memory.tags.map((t) => `[${t}]`).join(' ') : '(none)'}</Text>
      <Text>Source:     {memory.source ?? 'unknown'}</Text>
      <Text> </Text>
      <Text>Created:    {formatRelativeTime(memory.createdAt)}</Text>
      <Text>Updated:    {formatRelativeTime(memory.updatedAt)}</Text>
      <Text>Accessed:   {memory.accessCount}x{memory.lastAccessed ? ` (last: ${formatRelativeTime(memory.lastAccessed)})` : ''}</Text>
      <Text>Injected:   {memory.injectionCount}x</Text>
      <Text> </Text>
      <Text bold>Content</Text>
      <Text dimColor>{'─'.repeat(40)}</Text>
      <Text>{memory.content}</Text>
      {relations.length > 0 && <RelationsList relations={relations} memoryId={memory.id} />}
    </Box>
  );
}

function RelationsList({ relations, memoryId }: { relations: readonly Relation[]; memoryId: string }): React.ReactNode {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold>Relations</Text>
      <Text dimColor>{'─'.repeat(40)}</Text>
      {relations.map((r, i) => {
        const relColor = RELATION_COLORS[r.relationType] ?? 'white';
        const direction = r.sourceId === memoryId ? '→' : '←';
        const otherId = r.sourceId === memoryId ? r.targetId : r.sourceId;
        return (
          <Text key={i}>  {direction} <Text color={relColor}>{r.relationType}</Text> {otherId}</Text>
        );
      })}
    </Box>
  );
}
