import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Memory, Relation } from '../../types.js';
import { useTerminalSize } from '../hooks/use-terminal-size.js';
import { TYPE_COLORS, RELATION_COLORS } from '../colors.js';
import { formatRelativeTime } from '../data/formatters.js';
import { wrapContent } from '../data/wrap.js';

interface ExpandMemoryProps {
  readonly memory: Memory;
  readonly relations: readonly Relation[];
  readonly onClose: () => void;
}

export function ExpandMemory({ memory, relations, onClose }: ExpandMemoryProps): React.ReactNode {
  const { columns, rows } = useTerminalSize();
  const [scroll, setScroll] = useState(0);

  const contentWidth = Math.max(20, columns - 6);
  const chromeLines = 7 + (relations.length > 0 ? relations.length + 2 : 0);
  const viewportLines = Math.max(5, rows - chromeLines);

  const wrappedLines = wrapContent(memory.content, contentWidth);
  const totalLines = wrappedLines.length;
  const maxScroll = Math.max(0, totalLines - viewportLines);

  useEffect(() => { setScroll(0); }, [memory.id]);

  useInput((input, key) => {
    if (key.escape || input === 'q') { onClose(); return; }
    if (input === 'j' || key.downArrow) setScroll((s) => Math.min(maxScroll, s + 1));
    if (input === 'k' || key.upArrow) setScroll((s) => Math.max(0, s - 1));
    if (key.pageDown || input === ' ') setScroll((s) => Math.min(maxScroll, s + viewportLines));
    if (key.pageUp) setScroll((s) => Math.max(0, s - viewportLines));
    if (input === 'g') setScroll(0);
    if (input === 'G') setScroll(maxScroll);
  });

  const typeColor = TYPE_COLORS[memory.type] ?? 'white';
  const visible = wrappedLines.slice(scroll, scroll + viewportLines);
  const scrollInfo = totalLines > viewportLines
    ? ` [${scroll + 1}-${Math.min(totalLines, scroll + viewportLines)}/${totalLines}]`
    : ` [${totalLines} lines]`;
  const divider = '─'.repeat(Math.min(contentWidth, 80));

  return (
    <Box flexDirection="column" borderStyle="double" borderColor="blue" paddingX={1}>
      <Text bold>
        <Text color={typeColor}>[{memory.type}]</Text>{' '}
        {memory.title ?? '(untitled)'}
      </Text>
      <Text dimColor>
        id: {memory.id.slice(0, 8)} | project: {memory.project ?? '(none)'} | imp: {memory.importance.toFixed(2)} | updated: {formatRelativeTime(memory.updatedAt)}
      </Text>
      <Text dimColor>{divider}</Text>
      {visible.map((line, i) => (
        <Text key={`line-${scroll + i}`}>{line === '' ? ' ' : line}</Text>
      ))}
      {Array.from({ length: Math.max(0, viewportLines - visible.length) }).map((_, i) => (
        <Text key={`pad-${i}`}> </Text>
      ))}
      <Text dimColor>{divider}</Text>
      {relations.length > 0 && (
        <Box flexDirection="column">
          <Text bold>Relations</Text>
          {relations.map((r, i) => {
            const relColor = RELATION_COLORS[r.relationType] ?? 'white';
            const direction = r.sourceId === memory.id ? '→' : '←';
            const otherId = r.sourceId === memory.id ? r.targetId : r.sourceId;
            return <Text key={i}>  {direction} <Text color={relColor}>{r.relationType}</Text> {otherId}</Text>;
          })}
        </Box>
      )}
      <Text dimColor>
        {totalLines > viewportLines ? 'j/k scroll · space/PgDn page · g/G top/bottom · ' : ''}q/Esc close{scrollInfo}
      </Text>
    </Box>
  );
}

