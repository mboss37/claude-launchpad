import { useInput } from 'ink';
import type { MemoryType } from '../../types.js';

const TYPE_KEYS: Record<string, MemoryType> = {
  '1': 'working',
  '2': 'episodic',
  '3': 'semantic',
  '4': 'procedural',
  '5': 'pattern',
};

export interface KeybindingActions {
  readonly navigateUp: () => void;
  readonly navigateDown: () => void;
  readonly openSearch: () => void;
  readonly closeSearch: () => void;
  readonly filterByType: (type: MemoryType | undefined) => void;
  readonly cycleLifespan: () => void;
  readonly cycleProjectNext: () => void;
  readonly cycleProjectPrev: () => void;
  readonly cycleSort: () => void;
  readonly focusNext: () => void;
  readonly openProjectPicker: () => void;
  readonly showHelp: () => void;
  readonly deleteMemory: () => void;
  readonly refresh: () => void;
  readonly quit: () => void;
}

export function useKeybindings(
  actions: KeybindingActions,
  opts: { searchActive: boolean; pickerOpen: boolean },
): void {
  useInput((input, key) => {
    if (opts.searchActive) {
      if (key.escape) actions.closeSearch();
      return;
    }
    if (opts.pickerOpen) {
      if (key.escape) actions.openProjectPicker(); // toggle off
      return;
    }

    if (input === 'j' || key.downArrow) actions.navigateDown();
    if (input === 'k' || key.upArrow) actions.navigateUp();
    if (input === '/') actions.openSearch();
    if (key.escape) actions.closeSearch();
    if (input === '0') actions.filterByType(undefined);
    if (input in TYPE_KEYS) actions.filterByType(TYPE_KEYS[input]!);
    if (input === 'l') actions.cycleLifespan();
    if (input === 's') actions.cycleSort();
    if (input === 'p') actions.openProjectPicker();
    if (input === ']' || key.rightArrow) actions.cycleProjectNext();
    if (input === '[' || key.leftArrow) actions.cycleProjectPrev();
    if (key.tab) actions.focusNext();
    if (input === 'd') actions.deleteMemory();
    if (input === '?') actions.showHelp();
    if (input === 'r') actions.refresh();
    if (input === 'q') actions.quit();
  });
}
