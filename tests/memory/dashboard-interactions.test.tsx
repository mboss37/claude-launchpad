import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import { Text } from "ink";
import { App } from "../../src/commands/memory/dashboard/app.js";
import { DashboardErrorBoundary } from "../../src/commands/memory/dashboard/components/error-boundary.js";
import type { DashboardDataSource } from "../../src/commands/memory/dashboard/data/data-source.js";
import type { Memory, Relation } from "../../src/commands/memory/types.js";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ENTER = "\r";
const ESC = "";

function mem(
  id: string,
  title: string,
  project = "proj-a",
  extra: Partial<Memory> = {},
): Memory {
  return {
    id,
    type: "semantic",
    title,
    content: `content of ${title}`,
    context: null,
    source: "manual",
    project,
    tags: [`#${title.split(" ")[0]}`],
    importance: 0.6,
    baseImportance: 0.6,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    accessCount: 0,
    lastAccessed: null,
    injectionCount: 0,
    ...extra,
  };
}

function stubDataSource(
  memories: Memory[],
  relations: Relation[] = [],
): DashboardDataSource {
  const stub = {
    refresh: () => {},
    startWatching: () => {},
    stopWatching: () => {},
    getProjects: () => [...new Set(memories.map((m) => m.project ?? "(none)"))],
    getMemories: (filter?: { type?: string; project?: string }) =>
      memories.filter(
        (m) =>
          (!filter?.type || m.type === filter.type) &&
          (!filter?.project || m.project === filter.project),
      ),
    getRelationsForMemory: (id: string) =>
      relations.filter((r) => r.sourceId === id || r.targetId === id),
    getMemoryTitle: (id: string) =>
      memories.find((m) => m.id === id)?.title ?? undefined,
    getStats: () => ({
      total: memories.length,
      byType: {},
      dbSizeBytes: 0,
      projects: 1,
    }),
    countByProject: (p: string) =>
      memories.filter((m) => m.project === p).length,
    deleteMemory: () => true,
    purgeProject: () => 0,
  };
  return stub as unknown as DashboardDataSource;
}

const FIXTURE = [
  mem("id-alpha-one", "alpha one"),
  mem("id-alpha-two", "alpha two"),
  mem("id-beta", "beta note"),
];

describe("dashboard find-then-act (WP-048)", () => {
  it("search: type, Enter keeps the filter, j moves selection within results", async () => {
    const { stdin, lastFrame } = render(
      <App dataSource={stubDataSource(FIXTURE)} />,
    );
    await delay(30);
    stdin.write("/");
    await delay(20);
    stdin.write("alpha");
    await delay(30);
    expect(lastFrame()).not.toContain("beta note");
    stdin.write(ENTER);
    await delay(20);
    stdin.write("j");
    await delay(30);
    const frame = lastFrame()!;
    // Filter survived Enter, and j selected the second alpha (visible in detail pane)
    expect(frame).not.toContain("beta note");
    expect(frame).toContain("content of alpha two");
  });

  it("search: Esc cancels and clears the filter", async () => {
    const { stdin, lastFrame } = render(
      <App dataSource={stubDataSource(FIXTURE)} />,
    );
    await delay(30);
    stdin.write("/");
    await delay(20);
    stdin.write("alpha");
    await delay(30);
    stdin.write(ESC);
    await delay(30);
    expect(lastFrame()).toContain("beta note");
  });

  it("d prompts single-memory delete, X prompts project purge", async () => {
    const first = render(<App dataSource={stubDataSource(FIXTURE)} />);
    await delay(30);
    first.stdin.write("d");
    await delay(30);
    expect(first.lastFrame()).toContain("Delete memory?");
    expect(first.lastFrame()).not.toContain("all memories for project");
    first.unmount();

    const second = render(<App dataSource={stubDataSource(FIXTURE)} />);
    await delay(30);
    // X only fires with an active project — cycle to one first
    second.stdin.write("]");
    await delay(20);
    second.stdin.write("X");
    await delay(30);
    expect(second.lastFrame()).toContain("all memories for project");
  });

  it("relations render titles, not UUIDs", async () => {
    const relations: Relation[] = [
      {
        sourceId: "id-alpha-one",
        targetId: "id-beta",
        relationType: "relates_to",
        createdAt: "2026-06-01T00:00:00.000Z",
      } as Relation,
    ];
    const { stdin, lastFrame } = render(
      <App dataSource={stubDataSource(FIXTURE, relations)} />,
    );
    await delay(30);
    stdin.write(ENTER); // expand first memory
    await delay(30);
    const frame = lastFrame()!;
    expect(frame).toContain("beta note");
    expect(frame).not.toContain("id-beta");
  });

  it("narrowing the list clamps the selection instead of blanking the detail", async () => {
    const { stdin, lastFrame } = render(
      <App dataSource={stubDataSource(FIXTURE)} />,
    );
    await delay(30);
    stdin.write("j");
    await delay(15);
    stdin.write("j"); // select 3rd (beta)
    await delay(15);
    stdin.write("/");
    await delay(15);
    stdin.write("alpha"); // narrows to 2 — old index 2 is out of range
    await delay(30);
    // Detail pane must show a real memory, not blank
    expect(lastFrame()).toContain("content of alpha");
  });

  it("crash renders the boundary instead of stranding the terminal", async () => {
    function Bomb(): React.ReactNode {
      throw new Error("kaboom");
    }
    const { lastFrame } = render(
      <DashboardErrorBoundary>
        <Bomb />
        <Text>never</Text>
      </DashboardErrorBoundary>,
    );
    await delay(20);
    expect(lastFrame()).toContain("Dashboard crashed");
    expect(lastFrame()).toContain("kaboom");
  });
});
