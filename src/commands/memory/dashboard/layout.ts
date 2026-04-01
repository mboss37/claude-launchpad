import blessed from "blessed";
import type { DashboardDataSource } from "./data/data-source.js";
import type { Memory, MemoryType } from "../types.js";
import { createHeader } from "./widgets/header.js";
import { createMemoryList } from "./widgets/memory-list.js";
import { createMemoryDetail } from "./widgets/memory-detail.js";
import { createStatsBar } from "./widgets/stats-bar.js";
import { createSearchModal } from "./widgets/search-modal.js";
import { createProjectList } from "./widgets/project-list.js";
import { createProjectPickerModal } from "./widgets/project-picker-modal.js";
import {
  computeLifespan,
  type LifespanStatus,
} from "./data/formatters.js";
import { registerKeybindings } from "./keybindings.js";

// -- Types --------------------------------------------------------------------

export interface DashboardOptions {
  readonly onQuit: () => void;
}

export interface Dashboard {
  refresh(): void;
  destroy(): void;
}

type SortMode = "importance" | "age" | "access" | "lifespan";

const SORT_MODES: readonly SortMode[] = [
  "importance",
  "age",
  "access",
  "lifespan",
] as const;
const LIFESPAN_FILTERS: readonly (LifespanStatus | undefined)[] = [
  undefined,
  "healthy",
  "fading",
  "stale",
  "session",
] as const;

// -- Layout Assembly ----------------------------------------------------------

export function createDashboard(
  screen: blessed.Widgets.Screen,
  dataSource: DashboardDataSource,
  options: DashboardOptions,
): Dashboard {
  // -- State ------------------------------------------------------------------
  let currentTypeFilter: MemoryType | undefined;
  let currentProject: string | undefined;
  let currentProjectIndex = -1;
  let currentLifespanFilter: LifespanStatus | undefined;
  let currentSearchQuery = "";
  let sortMode: SortMode = "importance";
  let currentMemories: readonly Memory[] = [];

  // -- Create widgets ---------------------------------------------------------
  const header = createHeader(screen);
  const memoryList = createMemoryList(screen);
  const projectList = createProjectList(screen);
  const memoryDetail = createMemoryDetail(screen);
  const statsBar = createStatsBar(screen);
  const searchModal = createSearchModal(screen);
  const projectPickerModal = createProjectPickerModal(screen);

  // -- Position widgets -------------------------------------------------------
  header.widget.top = 0;
  header.widget.left = 0;
  header.widget.width = "100%";
  header.widget.height = 1;

  memoryList.widget.top = 1;
  memoryList.widget.left = 0;
  memoryList.widget.width = "60%";
  memoryList.widget.height = screen.rows - 4;

  projectList.widget.top = 1;
  projectList.widget.left = "60%";
  projectList.widget.width = "40%";
  projectList.widget.height = Math.max(
    8,
    Math.floor((screen.rows - 4) * 0.35),
  );

  memoryDetail.widget.top = projectList.widget.height + 1;
  memoryDetail.widget.left = "60%";
  memoryDetail.widget.width = "40%";
  memoryDetail.widget.height =
    screen.rows - 4 - projectList.widget.height;

  statsBar.widget.bottom = 0;
  statsBar.widget.left = 0;
  statsBar.widget.width = "100%";
  statsBar.widget.height = 3;

  // -- Wire events ------------------------------------------------------------
  memoryList.onSelect((memory: Memory) => {
    const relations = dataSource.getRelationsForMemory(memory.id);
    memoryDetail.showMemory(memory, relations);
    screen.render();
  });

  projectList.onSelect((project: string | undefined) => {
    if (project === currentProject) return;
    currentProject = project;
    currentProjectIndex = dataSource
      .getProjects()
      .findIndex((p) => p === project);
    refresh();
  });

  projectPickerModal.onSubmit((project: string | undefined) => {
    if (project === currentProject) return;
    currentProject = project;
    currentProjectIndex = dataSource
      .getProjects()
      .findIndex((p) => p === project);
    refresh();
  });

  searchModal.onSubmit((query: string) => {
    currentSearchQuery = query.trim();
    refresh();
  });

  searchModal.onCancel(() => {
    screen.render();
  });

  // -- Resize handler ---------------------------------------------------------
  screen.on("resize", () => {
    const listHeight = screen.rows - 4;
    memoryList.widget.height = listHeight;
    projectList.widget.height = Math.max(
      8,
      Math.floor(listHeight * 0.35),
    );
    memoryDetail.widget.top = projectList.widget.height + 1;
    memoryDetail.widget.height = listHeight - projectList.widget.height;
    screen.render();
  });

  // -- Sorting ----------------------------------------------------------------
  function sortMemories(
    memories: readonly Memory[],
  ): readonly Memory[] {
    const sorted = [...memories];
    switch (sortMode) {
      case "importance":
        sorted.sort((a, b) => b.importance - a.importance);
        break;
      case "age":
        sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        break;
      case "access":
        sorted.sort((a, b) => b.accessCount - a.accessCount);
        break;
      case "lifespan":
        sorted.sort(
          (a, b) =>
            computeLifespan(a).remaining - computeLifespan(b).remaining,
        );
        break;
    }
    return sorted;
  }

  // -- Filtering --------------------------------------------------------------
  function getCurrentProject(): string | undefined {
    return currentProject;
  }

  function applyTextFilter(
    memories: readonly Memory[],
    query?: string,
  ): readonly Memory[] {
    if (!query || query.trim().length === 0) return memories;
    const lower = query.toLowerCase();
    return memories.filter(
      (m) =>
        (m.title?.toLowerCase().includes(lower) ?? false) ||
        m.content.toLowerCase().includes(lower) ||
        m.tags.some((t) => t.toLowerCase().includes(lower)),
    );
  }

  function applyLifespanFilter(
    memories: readonly Memory[],
  ): readonly Memory[] {
    if (!currentLifespanFilter) return memories;
    return memories.filter(
      (m) => computeLifespan(m).status === currentLifespanFilter,
    );
  }

  // -- Refresh ----------------------------------------------------------------
  function refresh(): void {
    const previousFocus = screen.focused;
    dataSource.refresh();
    const raw = dataSource.getMemories({
      type: currentTypeFilter,
      project: getCurrentProject(),
    });
    const withLife = applyLifespanFilter(raw);
    const withSearch = applyTextFilter(withLife, currentSearchQuery);
    currentMemories = sortMemories(withSearch);
    memoryList.setData(currentMemories);
    projectList.setData(dataSource.getMemories(), currentProject);
    if (currentMemories.length === 0) {
      memoryDetail.clear();
    }
    // Always keep focus on memory list unless a specific widget has it
    const focusableWidgets: unknown[] = [memoryList.widget, projectList.widget, memoryDetail.widget];
    if (previousFocus && focusableWidgets.includes(previousFocus)) {
      previousFocus.focus();
    } else {
      memoryList.focus();
    }
    statsBar.setStats(dataSource.getStats(), currentMemories);

    const project = getCurrentProject();
    const label = [
      project ? `project:${project}` : "all projects",
      currentTypeFilter ? `type:${currentTypeFilter}` : "all types",
      currentLifespanFilter
        ? `life:${currentLifespanFilter}`
        : "all life",
      currentSearchQuery
        ? `search:${currentSearchQuery}`
        : "search:off",
      `sort:${sortMode}`,
    ].join(" | ");
    header.setLabel(`agentic-memory cockpit  [${label}]`);

    screen.render();
  }

  // -- Help overlay -----------------------------------------------------------
  function showHelp(): void {
    const helpBox = blessed.box({
      parent: screen,
      top: "center",
      left: "center",
      width: 50,
      height: 18,
      border: { type: "line" },
      style: { border: { fg: "yellow" }, bg: "black" },
      tags: true,
      content: [
        "{bold}{yellow-fg}Keybindings{/yellow-fg}{/bold}",
        "",
        "  j / k       Navigate list",
        "  Enter       Select memory",
        "  /           Search",
        "  Esc         Close search / Clear search",
        "  r           Refresh",
        "  1-5         Filter by type (0 = all)",
        "  l           Cycle lifespan filter",
        "  p           Open project picker",
        "  [ / ]       Previous / next project",
        "  s           Cycle sort mode (incl lifespan)",
        "  Tab         Focus next pane (list/projects/detail)",
        "  ?           Show this help",
        "  q           Quit",
        "",
        "{center}Press any key to close{/center}",
      ].join("\n"),
    });

    screen.render();
    helpBox.once("keypress", () => {
      helpBox.destroy();
      screen.render();
    });
    helpBox.focus();
  }

  // -- Register keybindings ---------------------------------------------------
  registerKeybindings(screen, {
    refresh,
    openSearch: () => searchModal.open(),
    closeSearch: () => {
      if (projectPickerModal.isOpen()) {
        projectPickerModal.close();
        return;
      }
      if (searchModal.isOpen()) {
        searchModal.close();
        return;
      }
      if (currentSearchQuery.length > 0) {
        currentSearchQuery = "";
        refresh();
      }
    },
    openProjectPicker: () => {
      projectPickerModal.open(
        dataSource.getProjects(),
        currentProject,
      );
    },
    filterByType: (type: string | null) => {
      currentTypeFilter =
        type === null ? undefined : (type as MemoryType);
      refresh();
    },
    cycleLifespan: () => {
      const idx = LIFESPAN_FILTERS.findIndex(
        (x) => x === currentLifespanFilter,
      );
      currentLifespanFilter =
        LIFESPAN_FILTERS[(idx + 1) % LIFESPAN_FILTERS.length];
      refresh();
    },
    cycleProjectNext: () => {
      const projects = dataSource.getProjects();
      if (projects.length === 0) return;
      currentProjectIndex =
        currentProjectIndex >= projects.length - 1
          ? -1
          : currentProjectIndex + 1;
      currentProject =
        currentProjectIndex < 0
          ? undefined
          : projects[currentProjectIndex];
      refresh();
      memoryList.focus();
    },
    cycleProjectPrev: () => {
      const projects = dataSource.getProjects();
      if (projects.length === 0) return;
      currentProjectIndex =
        currentProjectIndex <= -1
          ? projects.length - 1
          : currentProjectIndex - 1;
      currentProject =
        currentProjectIndex < 0
          ? undefined
          : projects[currentProjectIndex];
      refresh();
      memoryList.focus();
    },
    cycleSort: () => {
      const idx = SORT_MODES.indexOf(sortMode);
      sortMode = SORT_MODES[(idx + 1) % SORT_MODES.length]!;
      refresh();
    },
    quit: () => options.onQuit(),
    focusNext: () => {
      if (screen.focused === memoryList.widget) {
        projectList.widget.focus();
      } else if (screen.focused === projectList.widget) {
        memoryDetail.widget.focus();
      } else {
        memoryList.widget.focus();
      }
      screen.render();
    },
    showHelp,
  });

  // -- Destroy ----------------------------------------------------------------
  function destroy(): void {
    header.widget.destroy();
    memoryList.widget.destroy();
    projectList.widget.destroy();
    memoryDetail.widget.destroy();
    statsBar.widget.destroy();
    projectPickerModal.close();
    screen.render();
  }

  return { refresh, destroy };
}
