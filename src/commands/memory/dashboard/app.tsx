import React from 'react';
import { Box, useApp } from 'ink';
import type { DashboardDataSource } from './data/data-source.js';
import { useDashboardState } from './hooks/use-dashboard-state.js';
import { useKeybindings } from './hooks/use-keybindings.js';
import { useTerminalSize } from './hooks/use-terminal-size.js';
import { KeybindingBar } from './components/keybinding-bar.js';
import { Header } from './components/header.js';
import { SearchBar } from './components/search-bar.js';
import { MemoryList } from './components/memory-list.js';
import { MemoryDetail } from './components/memory-detail.js';
import { ProjectList } from './components/project-list.js';
import { StatsBar } from './components/stats-bar.js';
import { HelpOverlay } from './components/help-overlay.js';
import { ProjectPicker } from './components/project-picker.js';
import { DeleteConfirm } from './components/delete-confirm.js';
import { PurgeConfirm } from './components/purge-confirm.js';
import { ExpandMemory } from './components/expand-memory.js';

interface AppProps {
  readonly dataSource: DashboardDataSource;
}

export function App({ dataSource }: AppProps): React.ReactNode {
  const { exit } = useApp();
  const { columns, rows, layout } = useTerminalSize();
  const state = useDashboardState(dataSource);

  useKeybindings({
    navigateUp: state.navigateUp,
    navigateDown: state.navigateDown,
    openSearch: state.openSearch,
    closeSearch: state.closeSearch,
    filterByType: state.filterByType,
    cycleLifespan: state.cycleLifespan,
    cycleProjectNext: state.cycleProjectNext,
    cycleProjectPrev: state.cycleProjectPrev,
    cycleSort: state.cycleSort,
    focusNext: state.focusNext,
    removeMemory: state.promptDelete,
    purgeProject: state.promptPurge,
    openProjectPicker: () => state.setShowProjectPicker((v) => !v),
    showHelp: () => state.setShowHelp((v) => !v),
    expandMemory: state.expandMemory,
    quit: exit,
  }, {
    searchActive: state.searchActive,
    pickerOpen: state.showProjectPicker,
    expandOpen: state.showExpand,
  });

  if (state.showHelp) {
    return <HelpOverlay onClose={() => state.setShowHelp(false)} />;
  }

  if (state.showExpand && state.selectedMemory) {
    return (
      <ExpandMemory
        memory={state.selectedMemory}
        relations={state.relations}
        onClose={state.closeExpand}
      />
    );
  }

  if (state.showProjectPicker) {
    return (
      <ProjectPicker
        projects={[...state.projects]}
        activeProject={state.currentProject}
        onSelect={(p) => { state.setCurrentProject(p); state.setSelectedIndex(0); }}
        onClose={() => state.setShowProjectPicker(false)}
      />
    );
  }

  if (state.showDeleteConfirm && state.selectedMemory) {
    return (
      <DeleteConfirm
        memory={state.selectedMemory}
        onConfirm={state.confirmDelete}
        onCancel={state.cancelDelete}
      />
    );
  }

  if (state.showPurgeConfirm && state.currentProject) {
    return (
      <PurgeConfirm
        project={state.currentProject}
        memoryCount={dataSource.countByProject(state.currentProject)}
        onConfirm={state.confirmPurge}
        onCancel={state.cancelPurge}
      />
    );
  }

  const contentHeight = Math.max(4, rows - 6 - (state.searchActive ? 1 : 0));
  const isNarrow = layout === 'narrow';
  const listWidth = Math.floor(columns * 0.6);
  const rightWidth = columns - listWidth;
  // Target split: projects ≤ 1/3 of right column (capped at 12), detail takes the rest
  const projectsCount = new Set(state.filteredMemories.map((m) => m.project ?? '(none)')).size + 1;
  const projectListHeight = isNarrow
    ? 0
    : Math.min(Math.max(4, Math.floor(contentHeight / 3)), projectsCount + 3, 12);
  // Narrow layout stacks list + detail vertically — split contentHeight between them
  const listHeight = isNarrow ? Math.max(6, Math.floor(contentHeight * 0.6)) : contentHeight;
  const detailHeight = isNarrow
    ? Math.max(6, contentHeight - listHeight)
    : Math.max(6, contentHeight - projectListHeight);

  return (
    <Box flexDirection="column">
      <KeybindingBar />
      <Header
        project={state.currentProject}
        typeFilter={state.typeFilter}
        lifespanFilter={state.lifespanFilter}
        sortMode={state.sortMode}
        searchQuery={state.searchQuery}
        layout={layout}
      />
      {state.searchActive && (
        <SearchBar
          query={state.searchQuery}
          onChange={state.setSearchQuery}
          onClose={() => state.setSearchQuery(state.searchQuery)}
        />
      )}
      <Box flexDirection={isNarrow ? 'column' : 'row'} height={isNarrow ? undefined : contentHeight}>
        <Box width={isNarrow ? '100%' : '60%'}>
          <MemoryList
            memories={state.filteredMemories}
            selectedIndex={state.selectedIndex}
            isFocused={state.focusedPane === 'list'}
            height={listHeight}
          />
        </Box>
        <Box flexDirection="column" width={isNarrow ? '100%' : '40%'}>
          {!isNarrow && (
            <ProjectList
              memories={state.filteredMemories}
              activeProject={state.currentProject}
              isFocused={state.focusedPane === 'projects'}
              height={projectListHeight}
            />
          )}
          <MemoryDetail
            memory={state.selectedMemory}
            relations={state.relations}
            isFocused={state.focusedPane === 'detail'}
            height={detailHeight}
            width={rightWidth}
          />
        </Box>
      </Box>
      <StatsBar stats={state.stats} visible={state.filteredMemories} />
    </Box>
  );
}
