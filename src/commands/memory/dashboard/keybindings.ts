// -- Keybinding registry for TUI dashboard ------------------------------------

import type { Widgets } from "blessed";

export interface DashboardActions {
  readonly refresh: () => void;
  readonly openSearch: () => void;
  readonly closeSearch: () => void;
  readonly openProjectPicker: () => void;
  readonly filterByType: (type: string | null) => void;
  readonly cycleLifespan: () => void;
  readonly cycleProjectNext: () => void;
  readonly cycleProjectPrev: () => void;
  readonly cycleSort: () => void;
  readonly quit: () => void;
  readonly focusNext: () => void;
  readonly showHelp: () => void;
}

const TYPE_KEYS: Record<string, string> = {
  "1": "working",
  "2": "episodic",
  "3": "semantic",
  "4": "procedural",
  "5": "pattern",
};

export function registerKeybindings(
  screen: Widgets.Screen,
  actions: DashboardActions,
): void {
  screen.key(["q"], () => actions.quit());
  screen.key(["C-c"], () => actions.quit());
  screen.key(["r"], () => actions.refresh());
  screen.key(["/"], () => actions.openSearch());
  screen.key(["escape"], () => actions.closeSearch());
  screen.key(["tab"], () => actions.focusNext());
  screen.key(["p"], () => actions.openProjectPicker());
  screen.key(["]", "right"], () => actions.cycleProjectNext());
  screen.key(["[", "left"], () => actions.cycleProjectPrev());
  screen.key(["s"], () => actions.cycleSort());
  screen.key(["l"], () => actions.cycleLifespan());
  screen.key(["?"], () => actions.showHelp());
  screen.key(["0"], () => actions.filterByType(null));

  for (const [key, type] of Object.entries(TYPE_KEYS)) {
    screen.key([key], () => actions.filterByType(type));
  }
}
