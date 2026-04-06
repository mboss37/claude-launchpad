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

interface AppProps {
  readonly dataSource: DashboardDataSource;
}

export function App({ dataSource }: AppProps): React.ReactNode {
  const { exit } = useApp();
  const { rows, layout } = useTerminalSize();
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
    deleteMemory: state.promptDelete,
    openProjectPicker: () => state.setShowProjectPicker((v) => !v),
    showHelp: () => state.setShowHelp((v) => !v),
    refresh: state.refresh,
    quit: exit,
  }, {
    searchActive: state.searchActive,
    pickerOpen: state.showProjectPicker,
  });

  if (state.showHelp) {
    return <HelpOverlay onClose={() => state.setShowHelp(false)} />;
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

  const contentHeight = Math.max(4, rows - 6);
  const isNarrow = layout === 'narrow';

  return (
    <Box flexDirection="column">
      <KeybindingBar />
      <Header
        project={state.currentProject}
        typeFilter={state.typeFilter}
        lifespanFilter={state.lifespanFilter}
        sortMode={state.sortMode}
        searchQuery={state.searchQuery}
      />
      {state.searchActive && (
        <SearchBar
          query={state.searchQuery}
          onChange={state.setSearchQuery}
          onClose={() => state.setSearchQuery(state.searchQuery)}
        />
      )}
      <Box flexDirection={isNarrow ? 'column' : 'row'}>
        <Box width={isNarrow ? '100%' : '60%'}>
          <MemoryList
            memories={state.filteredMemories}
            selectedIndex={state.selectedIndex}
            isFocused={state.focusedPane === 'list'}
            height={contentHeight}
          />
        </Box>
        <Box flexDirection="column" width={isNarrow ? '100%' : '40%'}>
          {!isNarrow && (
            <ProjectList
              memories={state.filteredMemories}
              activeProject={state.currentProject}
              isFocused={state.focusedPane === 'projects'}
            />
          )}
          <MemoryDetail
            memory={state.selectedMemory}
            relations={state.relations}
            isFocused={state.focusedPane === 'detail'}
          />
        </Box>
      </Box>
      <StatsBar stats={state.stats} visible={state.filteredMemories} />
    </Box>
  );
}
