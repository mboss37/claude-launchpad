import { useState, useMemo, useEffect, useCallback } from 'react';
import type { DashboardDataSource } from '../data/data-source.js';
import type { Memory, MemoryType, Relation } from '../../types.js';
import type { DashboardStats } from '../data/data-source.js';
import { computeLifespan, type LifespanStatus } from '../data/formatters.js';

export type SortMode = 'importance' | 'age' | 'access' | 'lifespan';
export type FocusedPane = 'list' | 'projects' | 'detail';

const SORT_MODES: readonly SortMode[] = ['importance', 'age', 'access', 'lifespan'];
const LIFESPAN_FILTERS: readonly (LifespanStatus | undefined)[] = [
  undefined, 'healthy', 'fading', 'stale', 'session',
];

export function useDashboardState(dataSource: DashboardDataSource) {
  const [revision, setRevision] = useState(0);
  const [typeFilter, setTypeFilter] = useState<MemoryType | undefined>();
  const [lifespanFilter, setLifespanFilter] = useState<LifespanStatus | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchActive, setSearchActive] = useState(false);
  const [currentProject, setCurrentProject] = useState<string | undefined>();
  const [sortMode, setSortMode] = useState<SortMode>('importance');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [focusedPane, setFocusedPane] = useState<FocusedPane>('list');
  const [showHelp, setShowHelp] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    dataSource.refresh();
    setRevision((r) => r + 1);
    dataSource.startWatching(() => {
      dataSource.refresh();
      setRevision((r) => r + 1);
    });
    return () => dataSource.stopWatching();
  }, [dataSource]);

  const projects = useMemo(() => {
    void revision;
    return dataSource.getProjects();
  }, [dataSource, revision]);

  const filteredMemories = useMemo(() => {
    void revision;
    const raw = dataSource.getMemories({ type: typeFilter, project: currentProject });
    const withLife = lifespanFilter
      ? raw.filter((m) => computeLifespan(m).status === lifespanFilter)
      : raw;
    const withSearch = searchQuery
      ? withLife.filter((m) =>
          (m.title?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
          m.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
        )
      : withLife;
    return sortMemories(withSearch, sortMode);
  }, [dataSource, revision, typeFilter, lifespanFilter, searchQuery, currentProject, sortMode]);

  const selectedMemory = filteredMemories[selectedIndex];
  const relations = useMemo(
    () => selectedMemory ? dataSource.getRelationsForMemory(selectedMemory.id) : [],
    [dataSource, selectedMemory, revision],
  );
  const stats = useMemo(() => { void revision; return dataSource.getStats(); }, [dataSource, revision]);

  const navigateUp = useCallback(() => {
    setSelectedIndex((i) => Math.max(0, i - 1));
  }, []);
  const navigateDown = useCallback(() => {
    setSelectedIndex((i) => Math.min(filteredMemories.length - 1, i + 1));
  }, [filteredMemories.length]);

  const cycleSort = useCallback(() => {
    setSortMode((m) => SORT_MODES[(SORT_MODES.indexOf(m) + 1) % SORT_MODES.length]!);
  }, []);
  const cycleLifespan = useCallback(() => {
    setLifespanFilter((f) => {
      const idx = LIFESPAN_FILTERS.findIndex((x) => x === f);
      return LIFESPAN_FILTERS[(idx + 1) % LIFESPAN_FILTERS.length];
    });
  }, []);
  const cycleProjectNext = useCallback(() => {
    setCurrentProject((curr) => {
      const idx = curr ? projects.indexOf(curr) : -1;
      return idx >= projects.length - 1 ? undefined : projects[idx + 1];
    });
    setSelectedIndex(0);
  }, [projects]);
  const cycleProjectPrev = useCallback(() => {
    setCurrentProject((curr) => {
      const idx = curr ? projects.indexOf(curr) : -1;
      return idx <= 0 ? (idx === 0 ? undefined : projects[projects.length - 1]) : projects[idx - 1];
    });
    setSelectedIndex(0);
  }, [projects]);
  const focusNext = useCallback(() => {
    setFocusedPane((p) => p === 'list' ? 'projects' : p === 'projects' ? 'detail' : 'list');
  }, []);
  const filterByType = useCallback((type: MemoryType | undefined) => {
    setTypeFilter(type);
    setSelectedIndex(0);
  }, []);
  const openSearch = useCallback(() => setSearchActive(true), []);
  const closeSearch = useCallback(() => {
    setSearchActive(false);
    setSearchQuery('');
    setSelectedIndex(0);
  }, []);
  const refresh = useCallback(() => {
    dataSource.refresh();
    setRevision((r) => r + 1);
  }, [dataSource]);
  const promptDelete = useCallback(() => {
    if (selectedMemory) setShowDeleteConfirm(true);
  }, [selectedMemory]);
  const confirmDelete = useCallback(() => {
    if (!selectedMemory) return;
    dataSource.deleteMemory(selectedMemory.id);
    setShowDeleteConfirm(false);
    setSelectedIndex((i) => Math.max(0, i - 1));
    dataSource.refresh();
    setRevision((r) => r + 1);
  }, [dataSource, selectedMemory]);
  const cancelDelete = useCallback(() => setShowDeleteConfirm(false), []);

  return {
    typeFilter, lifespanFilter, searchQuery, searchActive, currentProject,
    sortMode, selectedIndex, focusedPane, showHelp, showProjectPicker, showDeleteConfirm,
    filteredMemories, selectedMemory, relations, projects, stats,
    setSearchQuery, setCurrentProject, setSelectedIndex, setShowHelp, setShowProjectPicker,
    navigateUp, navigateDown, cycleSort, cycleLifespan,
    cycleProjectNext, cycleProjectPrev, focusNext, filterByType,
    openSearch, closeSearch, refresh, promptDelete, confirmDelete, cancelDelete,
  };
}

function sortMemories(memories: readonly Memory[], mode: SortMode): readonly Memory[] {
  const sorted = [...memories];
  const sorters: Record<SortMode, (a: Memory, b: Memory) => number> = {
    importance: (a, b) => b.importance - a.importance,
    age: (a, b) => b.createdAt.localeCompare(a.createdAt),
    access: (a, b) => b.accessCount - a.accessCount,
    lifespan: (a, b) => computeLifespan(a).remaining - computeLifespan(b).remaining,
  };
  sorted.sort(sorters[mode]);
  return sorted;
}
