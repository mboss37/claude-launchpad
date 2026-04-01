import blessed from "blessed";
import type { Memory } from "../../types.js";
import {
  truncate,
  formatRelativeTime,
  computeLifespan,
  formatLifespanLabel,
  escapeBlessedTags,
} from "../data/formatters.js";
import { TYPE_ABBREV } from "../colors.js";

export interface MemoryListWidget {
  readonly widget: blessed.Widgets.ListElement;
  setData(memories: readonly Memory[]): void;
  onSelect(callback: (memory: Memory) => void): void;
  focus(): void;
}

export function createMemoryList(
  screen: blessed.Widgets.Screen,
): MemoryListWidget {
  const list = blessed.list({
    parent: screen,
    top: 1,
    left: 0,
    width: "60%",
    height: "100%-4",
    keys: true,
    vi: true,
    mouse: true,
    tags: true,
    interactive: true,
    scrollable: true,
    alwaysScroll: true,
    border: { type: "line" },
    label: " Memories ",
    style: {
      border: { fg: "cyan" },
      item: { fg: "white" },
      selected: { fg: "black", bg: "green" },
    },
    scrollbar: {
      style: { bg: "cyan" },
    },
  });

  let currentMemories: readonly Memory[] = [];
  let selectCallback: ((memory: Memory) => void) | null = null;

  function colorForLife(
    status: ReturnType<typeof computeLifespan>["status"],
  ): string {
    switch (status) {
      case "healthy":
        return "green";
      case "fading":
        return "yellow";
      case "stale":
        return "red";
      case "session":
        return "magenta";
    }
  }

  function buildRows(memories: readonly Memory[]): string[] {
    return memories.map((m) => {
      const life = computeLifespan(m);
      const title = escapeBlessedTags(
        truncate(m.title ?? m.content.replace(/\n/g, " "), 36),
      );
      const project = escapeBlessedTags(truncate(m.project ?? "(none)", 14));
      const type = TYPE_ABBREV[m.type] ?? m.type;
      const lifeColor = colorForLife(life.status);
      const lifeLabel = formatLifespanLabel(life.status).trim();
      const imp = `${Math.round(m.importance * 100)}%`;
      const updated = formatRelativeTime(m.updatedAt);
      return [
        `{bold}${title}{/bold}`,
        `{gray-fg}${project}{/gray-fg}`,
        `{cyan-fg}${type}{/cyan-fg}`,
        `{${lifeColor}-fg}${lifeLabel}{/${lifeColor}-fg}`,
        `{white-fg}${imp}{/white-fg}`,
        `{gray-fg}${updated}{/gray-fg}`,
        `{blue-fg}acc:${m.accessCount}{/blue-fg}`,
      ].join("  ");
    });
  }

  function emitCurrentSelection(): void {
    const idx = (list as unknown as { selected: number }).selected;
    const memory = currentMemories[idx];
    if (memory && selectCallback) selectCallback(memory);
  }

  list.on("select", () => emitCurrentSelection());
  list.on("select item", () => emitCurrentSelection());

  return {
    widget: list,
    setData(memories: readonly Memory[]) {
      currentMemories = memories;
      const rows = buildRows(memories);
      list.setItems(rows);
    },
    onSelect(callback: (memory: Memory) => void) {
      selectCallback = callback;
    },
    focus() {
      list.focus();
      if (currentMemories.length > 0) {
        list.select(0);
        emitCurrentSelection();
      }
    },
  };
}
