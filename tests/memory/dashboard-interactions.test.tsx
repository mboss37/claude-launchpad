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
    calls: [] as unknown[],
    getMemories(filter?: { type?: string; project?: string; query?: string }) {
      this.calls.push(filter);
      return memories.filter(
        (m) =>
          (!filter?.type || m.type === filter.type) &&
          (!filter?.project || m.project === filter.project) &&
          (!filter?.query ||
            (m.title ?? "").toLowerCase().includes(filter.query.toLowerCase()) ||
            m.content.toLowerCase().includes(filter.query.toLowerCase())),
      );
    },
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
    deleted: [] as string[],
    restored: [] as string[],
    updates: [] as unknown[],
    deleteMemory(id: string) {
      this.deleted.push(id);
      const m = memories.find((x) => x.id === id) ?? null;
      if (m) memories.splice(memories.indexOf(m), 1);
      return m;
    },
    restoreMemory(snapshot: Memory) {
      this.restored.push(snapshot.id);
      memories.push(snapshot);
      return true;
    },
    updateMemory(id: string, updates: unknown) {
      this.updates.push({ id, updates });
      return true;
    },
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
    await delay(80);
    stdin.write("/");
    await delay(80);
    stdin.write("alpha");
    await delay(80);
    expect(lastFrame()).not.toContain("beta note");
    stdin.write(ENTER);
    await delay(80);
    stdin.write("j");
    await delay(80);
    const frame = lastFrame()!;
    // Filter survived Enter, and j selected the second alpha (visible in detail pane)
    expect(frame).not.toContain("beta note");
    expect(frame).toContain("content of alpha two");
  });

  it("search: Esc cancels and clears the filter", async () => {
    const { stdin, lastFrame } = render(
      <App dataSource={stubDataSource(FIXTURE)} />,
    );
    await delay(80);
    stdin.write("/");
    await delay(80);
    stdin.write("alpha");
    await delay(80);
    stdin.write(ESC);
    await delay(80);
    expect(lastFrame()).toContain("beta note");
  });

  it("d prompts single-memory delete, X prompts project purge", async () => {
    const first = render(<App dataSource={stubDataSource(FIXTURE)} />);
    await delay(80);
    first.stdin.write("d");
    await delay(80);
    expect(first.lastFrame()).toContain("Delete memory?");
    expect(first.lastFrame()).not.toContain("all memories for project");
    first.unmount();

    const second = render(<App dataSource={stubDataSource(FIXTURE)} />);
    await delay(80);
    // X only fires with an active project — cycle to one first
    second.stdin.write("]");
    await delay(80);
    second.stdin.write("X");
    await delay(80);
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
    await delay(80);
    stdin.write(ENTER); // expand first memory
    await delay(80);
    const frame = lastFrame()!;
    expect(frame).toContain("beta note");
    expect(frame).not.toContain("id-beta");
  });

  it("narrowing the list clamps the selection instead of blanking the detail", async () => {
    const { stdin, lastFrame } = render(
      <App dataSource={stubDataSource(FIXTURE)} />,
    );
    await delay(80);
    stdin.write("j");
    await delay(80);
    stdin.write("j"); // select 3rd (beta)
    await delay(80);
    stdin.write("/");
    await delay(80);
    stdin.write("alpha"); // narrows to 2 — old index 2 is out of range
    await delay(80);
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
    await delay(80);
    expect(lastFrame()).toContain("Dashboard crashed");
    expect(lastFrame()).toContain("kaboom");
  });
});

describe('review findings: modal guards and index reconciliation', () => {
  it('j and q are inert while the delete dialog is open (target cannot shift)', async () => {
    const { stdin, lastFrame } = render(<App dataSource={stubDataSource(FIXTURE)} />);
    await delay(80);
    stdin.write('d');
    await delay(80);
    expect(lastFrame()).toContain('alpha one');
    stdin.write('j');
    await delay(80);
    // Dialog still targets the first memory — selection did not move underneath it
    expect(lastFrame()).toContain('alpha one');
    expect(lastFrame()).not.toContain('alpha two');
    stdin.write('q');
    await delay(80);
    // q must not quit from inside a destructive dialog
    expect(lastFrame()).toContain('Delete memory?');
  });

  it('k works immediately after a narrowing filter (raw index reconciled)', async () => {
    const { stdin, lastFrame } = render(<App dataSource={stubDataSource(FIXTURE)} />);
    await delay(80);
    stdin.write('j');
    await delay(80);
    stdin.write('j'); // raw index 2 (beta)
    await delay(80);
    stdin.write('/');
    await delay(80);
    stdin.write('alpha');
    await delay(80);
    stdin.write('\r'); // keep filter: 2 results, raw index still 2
    await delay(80);
    stdin.write('k'); // must move to alpha one IMMEDIATELY, not burn presses
    await delay(80);
    expect(lastFrame()).toContain('content of alpha one');
  });
});

describe("curation (WP-049)", () => {
  it("delete then u restores the memory", async () => {
    const ds = stubDataSource([...FIXTURE.map((m) => ({ ...m }))]) as any;
    const { stdin, lastFrame } = render(<App dataSource={ds} />);
    await delay(80);
    stdin.write("d");
    await delay(80);
    stdin.write("y");
    await delay(80);
    expect(ds.deleted).toContain("id-alpha-one");
    expect(lastFrame()).toContain("press u to undo");
    stdin.write("u");
    await delay(80);
    expect(ds.restored).toContain("id-alpha-one");
    expect(lastFrame()).toContain("Restored");
  });

  it("+ re-rates importance through the data source", async () => {
    const ds = stubDataSource([...FIXTURE.map((m) => ({ ...m }))]) as any;
    const { stdin } = render(<App dataSource={ds} />);
    await delay(80);
    stdin.write("+");
    await delay(80);
    expect(ds.updates.length).toBe(1);
    expect((ds.updates[0] as any).updates.importance).toBeCloseTo(0.7, 6);
  });

  it("t opens the tag editor and Enter saves", async () => {
    const ds = stubDataSource([...FIXTURE.map((m) => ({ ...m }))]) as any;
    const { stdin, lastFrame } = render(<App dataSource={ds} />);
    await delay(80);
    stdin.write("t");
    await delay(80);
    expect(lastFrame()).toContain("Tags (comma-separated)");
    stdin.write(", extra");
    await delay(80);
    stdin.write("\r");
    await delay(80);
    expect(ds.updates.length).toBe(1);
    expect((ds.updates[0] as any).updates.tags).toContain("extra");
  });

  it("search routes the query through the data source (FTS path)", async () => {
    const ds = stubDataSource([...FIXTURE.map((m) => ({ ...m }))]) as any;
    const { stdin } = render(<App dataSource={ds} />);
    await delay(80);
    stdin.write("/");
    await delay(80);
    stdin.write("alpha");
    await delay(80);
    const queried = (ds.calls as any[]).some((c) => c && c.query === "alpha");
    expect(queried).toBe(true);
  });
});

describe("review fixes (Sprint 41)", () => {
  it("Esc cancels the tag editor without saving", async () => {
    const ds = stubDataSource([...FIXTURE.map((m) => ({ ...m }))]) as any;
    const { stdin, lastFrame } = render(<App dataSource={ds} />);
    await delay(80);
    stdin.write("t");
    await delay(80);
    expect(lastFrame()).toContain("Tags (comma-separated)");
    stdin.write(", junk");
    await delay(80);
    stdin.write("\u001B");
    await delay(80);
    expect(lastFrame()).not.toContain("Tags (comma-separated)");
    expect(ds.updates.length).toBe(0);
  });

  it("undo reports failure honestly when the restore hits nothing", async () => {
    const ds = stubDataSource([...FIXTURE.map((m) => ({ ...m }))]) as any;
    ds.restoreMemory = () => false;
    const { stdin, lastFrame } = render(<App dataSource={ds} />);
    await delay(80);
    stdin.write("d");
    await delay(80);
    stdin.write("y");
    await delay(80);
    stdin.write("u");
    await delay(80);
    expect(lastFrame()).toContain("Could not restore");
  });
});
