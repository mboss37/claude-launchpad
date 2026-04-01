import blessed from "blessed";
import type { Memory, Relation } from "../../types.js";
import {
  formatImportanceBar,
  formatRelativeTime,
  computeLifespan,
  formatLifespanLabel,
  escapeBlessedTags,
} from "../data/formatters.js";
import { TYPE_COLORS, RELATION_COLORS } from "../colors.js";

export interface MemoryDetailWidget {
  readonly widget: blessed.Widgets.BoxElement;
  showMemory(memory: Memory, relations: readonly Relation[]): void;
  clear(): void;
}

export function createMemoryDetail(
  screen: blessed.Widgets.Screen,
): MemoryDetailWidget {
  const box = blessed.box({
    parent: screen,
    top: 1,
    left: "45%",
    width: "55%",
    height: "100%-4",
    keys: true,
    vi: true,
    mouse: true,
    scrollable: true,
    alwaysScroll: true,
    tags: true,
    border: { type: "line" },
    label: " Detail ",
    style: {
      border: { fg: "blue" },
      fg: "white",
    },
    scrollbar: {
      style: { bg: "blue" },
    },
  });

  return {
    widget: box,
    showMemory(memory: Memory, relations: readonly Relation[]) {
      const typeColor = TYPE_COLORS[memory.type] ?? "white";
      const life = computeLifespan(memory);
      const lines: string[] = [
        `{bold}${escapeBlessedTags(memory.title ?? "(untitled)")}{/bold}`,
        "",
        `Type:       {${typeColor}-fg}${memory.type}{/${typeColor}-fg}`,
        `Lifespan:   ${formatLifespanLabel(life.status)} | age ${Math.round(life.ageDays)}d | tau ${life.tauDays}d`,
        `Health:     ${formatImportanceBar(life.remaining)} ${(life.remaining * 100).toFixed(0)}% remaining`,
        `Importance: ${formatImportanceBar(memory.importance)} ${memory.importance.toFixed(2)}`,
        `Project:    ${escapeBlessedTags(memory.project ?? "(none)")}`,
        `Tags:       ${memory.tags.length > 0 ? memory.tags.map((t) => `[${escapeBlessedTags(t)}]`).join(" ") : "(none)"}`,
        `Source:     ${memory.source ?? "unknown"}`,
        "",
        `Created:    ${formatRelativeTime(memory.createdAt)}`,
        `Updated:    ${formatRelativeTime(memory.updatedAt)}`,
        `Accessed:   ${memory.accessCount}x${memory.lastAccessed ? ` (last: ${formatRelativeTime(memory.lastAccessed)})` : ""}`,
        `Injected:   ${memory.injectionCount}x`,
        "",
        "{bold}Content{/bold}",
        "{gray-fg}" + "\u2500".repeat(40) + "{/gray-fg}",
        escapeBlessedTags(memory.content),
      ];

      if (relations.length > 0) {
        lines.push(
          "",
          "{bold}Relations{/bold}",
          "{gray-fg}" + "\u2500".repeat(40) + "{/gray-fg}",
        );
        for (const r of relations) {
          const relColor = RELATION_COLORS[r.relationType] ?? "white";
          const direction = r.sourceId === memory.id ? "\u2192" : "\u2190";
          const otherId =
            r.sourceId === memory.id ? r.targetId : r.sourceId;
          lines.push(
            `  ${direction} {${relColor}-fg}${r.relationType}{/${relColor}-fg} ${otherId}`,
          );
        }
      }

      box.setContent(lines.join("\n"));
      box.scrollTo(0);
    },
    clear() {
      box.setContent("{gray-fg}Select a memory to view details{/gray-fg}");
    },
  };
}
