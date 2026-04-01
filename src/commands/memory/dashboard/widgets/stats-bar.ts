import blessed from "blessed";
import type { DashboardStats } from "../data/data-source.js";
import { formatBytes, computeLifespan } from "../data/formatters.js";
import { TYPE_COLORS } from "../colors.js";
import type { Memory } from "../../types.js";

export interface StatsBarWidget {
  readonly widget: blessed.Widgets.BoxElement;
  setStats(stats: DashboardStats, visibleMemories: readonly Memory[]): void;
}

export function createStatsBar(
  screen: blessed.Widgets.Screen,
): StatsBarWidget {
  const box = blessed.box({
    parent: screen,
    bottom: 0,
    left: 0,
    width: "100%",
    height: 3,
    tags: true,
    border: { type: "line" },
    style: {
      border: { fg: "blue" },
      fg: "white",
    },
  });

  return {
    widget: box,
    setStats(stats: DashboardStats, visibleMemories: readonly Memory[]) {
      const typeBreakdown = Object.entries(stats.byType)
        .filter(([, count]) => count > 0)
        .map(([type, count]) => {
          const color =
            TYPE_COLORS[type as keyof typeof TYPE_COLORS] ?? "white";
          return `{${color}-fg}${type}:${count}{/${color}-fg}`;
        })
        .join("  ");

      const projects = Object.entries(stats.byProject)
        .map(([name, count]) => `${name}(${count})`)
        .join(" ");

      const lifeCounts = { healthy: 0, fading: 0, stale: 0, session: 0 };
      for (const memory of visibleMemories) {
        lifeCounts[computeLifespan(memory).status]++;
      }
      const lifeSummary = `Life H:${lifeCounts.healthy} F:${lifeCounts.fading} S:${lifeCounts.stale} Sess:${lifeCounts.session}`;

      box.setContent(
        `{bold}Total:{/bold} ${stats.total}  {bold}Relations:{/bold} ${stats.relations}  {bold}Visible:{/bold} ${visibleMemories.length}  {bold}DB:{/bold} ${formatBytes(stats.dbSizeBytes)}\n{bold}${lifeSummary}{/bold}  ${typeBreakdown}  ${projects}`,
      );
    },
  };
}
