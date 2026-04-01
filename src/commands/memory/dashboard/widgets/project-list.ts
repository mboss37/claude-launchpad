import blessed from "blessed";
import type { Memory } from "../../types.js";
import { computeLifespan } from "../data/formatters.js";

export interface ProjectListWidget {
  readonly widget: blessed.Widgets.ListElement;
  setData(memories: readonly Memory[], activeProject?: string): void;
  onSelect(callback: (project: string | undefined) => void): void;
}

interface ProjectRow {
  readonly project: string | undefined;
  readonly total: number;
  readonly healthPct: number;
}

export function createProjectList(
  screen: blessed.Widgets.Screen,
): ProjectListWidget {
  const list = blessed.list({
    parent: screen,
    top: 1,
    left: "60%",
    width: "40%",
    height: "35%-1",
    keys: true,
    vi: true,
    mouse: true,
    tags: true,
    border: { type: "line" },
    label: " Projects ",
    scrollable: true,
    style: {
      border: { fg: "magenta" },
      item: { fg: "white" },
      selected: { fg: "black", bg: "yellow" },
    },
  });

  let rows: readonly ProjectRow[] = [];
  let selectCallback: ((project: string | undefined) => void) | null = null;
  let suppressSelect = false;

  function buildRows(memories: readonly Memory[]): readonly ProjectRow[] {
    const byProject = new Map<string, Memory[]>();
    for (const memory of memories) {
      const project = memory.project ?? "(none)";
      const bucket = byProject.get(project);
      if (bucket) {
        bucket.push(memory);
      } else {
        byProject.set(project, [memory]);
      }
    }

    const items: ProjectRow[] = [];
    for (const [project, projectMemories] of byProject.entries()) {
      const avgRemaining =
        projectMemories.reduce(
          (sum, m) => sum + computeLifespan(m).remaining,
          0,
        ) / projectMemories.length;
      items.push({
        project,
        total: projectMemories.length,
        healthPct: Math.round(avgRemaining * 100),
      });
    }

    items.sort((a, b) => b.total - a.total);
    const allHealth =
      memories.length > 0
        ? Math.round(
            (memories.reduce(
              (sum, m) => sum + computeLifespan(m).remaining,
              0,
            ) /
              memories.length) *
              100,
          )
        : 0;
    return [
      { project: undefined, total: memories.length, healthPct: allHealth },
      ...items,
    ];
  }

  function render(activeProject?: string): void {
    const body = rows.map((row) => {
      const isActive =
        row.project === activeProject ||
        (row.project === undefined && !activeProject);
      const projectName = row.project ?? "All projects";
      const healthColor =
        row.healthPct > 62 ? "green" : row.healthPct > 32 ? "yellow" : "red";
      const nameCol = projectName.padEnd(20, " ").slice(0, 20);
      const countCol = String(row.total).padStart(3, " ");
      const healthCol = `${String(row.healthPct).padStart(3, " ")}%`;
      return [
        isActive ? "{bold}> {/bold}" : "  ",
        `{bold}${nameCol}{/bold}`,
        `  {cyan-fg}${countCol} mem{/cyan-fg}`,
        `  {${healthColor}-fg}${healthCol} health{/${healthColor}-fg}`,
      ].join("");
    });
    list.setItems(body);
  }

  function emitSelection(): void {
    if (suppressSelect) return;
    const selectedIndex = (list as unknown as { selected: number }).selected;
    const row = rows[selectedIndex];
    if (!row || !selectCallback) return;
    selectCallback(row.project);
  }

  list.on("select", () => emitSelection());

  return {
    widget: list,
    setData(memories: readonly Memory[], activeProject?: string) {
      rows = buildRows(memories);
      render(activeProject);
      if (rows.length > 0) {
        suppressSelect = true;
        const idx = rows.findIndex(
          (r) =>
            r.project === activeProject ||
            (r.project === undefined && !activeProject),
        );
        list.select(Math.max(0, idx));
        setImmediate(() => {
          suppressSelect = false;
        });
      }
    },
    onSelect(callback: (project: string | undefined) => void) {
      selectCallback = callback;
    },
  };
}
