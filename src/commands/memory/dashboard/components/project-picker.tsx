import React from 'react';
import { Box, Text, useInput } from 'ink';

interface ProjectPickerProps {
  readonly projects: readonly string[];
  readonly activeProject?: string;
  readonly onSelect: (project: string | undefined) => void;
  readonly onClose: () => void;
}

export function ProjectPicker({ projects, activeProject, onSelect, onClose }: ProjectPickerProps): React.ReactNode {
  const [selectedIdx, setSelectedIdx] = React.useState(() => {
    if (!activeProject) return 0;
    const idx = projects.indexOf(activeProject);
    return idx >= 0 ? idx + 1 : 0;
  });

  const options = [
    { label: 'All projects', project: undefined as string | undefined },
    ...projects.map((p) => ({ label: p, project: p as string | undefined })),
  ];

  useInput((input, key) => {
    if (key.escape) { onClose(); return; }
    if (input === 'j' || key.downArrow) setSelectedIdx((i) => Math.min(options.length - 1, i + 1));
    if (input === 'k' || key.upArrow) setSelectedIdx((i) => Math.max(0, i - 1));
    if (key.return) {
      onSelect(options[selectedIdx]?.project);
      onClose();
    }
  });

  return (
    <Box flexDirection="column" borderStyle="double" borderColor="yellow" paddingX={2} paddingY={1}>
      <Text bold color="yellow">Project Picker</Text>
      <Text dimColor>Enter=select  Esc=close</Text>
      <Text> </Text>
      {options.map((opt, i) => {
        const isSelected = i === selectedIdx;
        const isActive = opt.project === activeProject || (opt.project === undefined && !activeProject);
        return (
          <Text key={opt.label} inverse={isSelected}>
            {isActive ? '> ' : '  '}{opt.label}
          </Text>
        );
      })}
    </Box>
  );
}
