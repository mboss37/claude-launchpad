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
import { wrapContent } from '../data/wrap.js';

const METADATA_ROWS = 18;
const BORDER_ROWS = 2;
const MIN_CONTENT_ROWS = 2;

interface MemoryDetailProps {
  readonly memory?: Memory;
  readonly relations: readonly Relation[];
  readonly isFocused: boolean;
  readonly height: number;
  readonly width: number;
}

export function MemoryDetail({ memory, relations, isFocused, height, width }: MemoryDetailProps): React.ReactNode {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={isFocused ? 'blue' : 'gray'}
      paddingX={1}
      height={height}
    >
      <Text bold color={isFocused ? 'blue' : 'gray'}> Detail </Text>
      {!memory ? (
        <Text dimColor>Select a memory to view details</Text>
      ) : (
        <DetailContent memory={memory} relations={relations} height={height} width={width} />
      )}
    </Box>
  );
}

interface DetailContentProps {
  readonly memory: Memory;
  readonly relations: readonly Relation[];
  readonly height: number;
  readonly width: number;
}

function DetailContent({ memory, relations, height, width }: DetailContentProps): React.ReactNode {
  const life = computeLifespan(memory);
  const typeColor = TYPE_COLORS[memory.type] ?? 'white';
  const relationRows = relations.length > 0 ? relations.length + 2 : 0;
  const contentRows = Math.max(MIN_CONTENT_ROWS, height - METADATA_ROWS - BORDER_ROWS - relationRows);
  const contentWidth = Math.max(10, width - 4);
  const preview = truncateContent(memory.content, contentRows, contentWidth);

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
      <Text dimColor>{'─'.repeat(Math.min(contentWidth, 40))}</Text>
      {preview.lines.map((line, i) => (
        <Text key={`line-${i}`}>{line === '' ? ' ' : line}</Text>
      ))}
      {preview.truncated && (
        <Text dimColor>… +{preview.remainingLines} line{preview.remainingLines === 1 ? '' : 's'} · press Enter to view full</Text>
      )}
      {relations.length > 0 && <RelationsList relations={relations} memoryId={memory.id} />}
    </Box>
  );
}

interface ContentPreview {
  readonly lines: readonly string[];
  readonly truncated: boolean;
  readonly remainingLines: number;
}

function truncateContent(content: string, maxRows: number, wrapWidth: number): ContentPreview {
  const allLines = wrapContent(content, wrapWidth);
  if (allLines.length <= maxRows) {
    return { lines: allLines, truncated: false, remainingLines: 0 };
  }
  // Reserve one row for the "... press Enter" hint
  const visible = Math.max(1, maxRows - 1);
  return {
    lines: allLines.slice(0, visible),
    truncated: true,
    remainingLines: allLines.length - visible,
  };
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
